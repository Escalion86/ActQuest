const fs = require('fs')
const path = require('path')
const mongoose = require('mongoose')

const analyzeTeamCaptainIntegrity = require('../helpers/analyzeTeamCaptainIntegrity')

const applyEnvLines = (fileContent) => {
  String(fileContent || '')
    .split(/\r?\n/g)
    .forEach((line) => {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) {
        return
      }

      const separatorIndex = trimmed.indexOf('=')
      if (separatorIndex <= 0) {
        return
      }

      const key = trimmed.slice(0, separatorIndex).trim()
      if (!key) {
        return
      }

      let value = trimmed.slice(separatorIndex + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }

      process.env[key] = value
    })
}

const loadEnv = () => {
  try {
    const envLocalPath = path.resolve(process.cwd(), '.env.local')
    const envPath = path.resolve(process.cwd(), '.env')
    const envFilePath = fs.existsSync(envLocalPath) ? envLocalPath : envPath

    try {
      const dotenv = require('dotenv')
      if (fs.existsSync(envFilePath)) {
        dotenv.config({ path: envFilePath, override: true })
      }
    } catch {
      if (fs.existsSync(envFilePath)) {
        applyEnvLines(fs.readFileSync(envFilePath, 'utf8'))
      }
    }
  } catch {
    // dotenv optional
  }
}

const parseArgs = () => {
  const args = process.argv.slice(2)
  const result = {
    teamId: '',
    limit: 200,
    json: false,
    failOnIssues: false,
  }

  args.forEach((arg) => {
    if (arg === '--json') {
      result.json = true
      return
    }

    if (arg === '--fail-on-issues') {
      result.failOnIssues = true
      return
    }

    if (arg.startsWith('--teamId=')) {
      result.teamId = arg.slice('--teamId='.length).trim()
      return
    }

    if (arg.startsWith('--limit=')) {
      const parsed = Number(arg.slice('--limit='.length).trim())
      if (Number.isFinite(parsed) && parsed > 0) {
        result.limit = Math.trunc(parsed)
      }
    }
  })

  return result
}

const printTextReport = (report, options) => {
  const { summary, teamsWithIssues } = report

  console.log('Проверка капитанства в командах')
  console.log('------------------------------')
  if (options.teamId) {
    console.log(`Фильтр по teamId: ${options.teamId}`)
  }
  console.log(`Команд проверено: ${summary.teamsCheckedCount}`)
  console.log(`Команд с проблемами: ${summary.teamsWithIssuesCount}`)
  console.log(`Без капитана: ${summary.noCaptainTeamsCount}`)
  console.log(`С несколькими капитанами: ${summary.multipleCaptainsTeamsCount}`)
  if (summary.limitApplied) {
    console.log(`Лимит вывода: ${summary.limitApplied}`)
  }
  if (summary.truncated) {
    console.log('Вывод усечён по limit')
  }

  if (!teamsWithIssues.length) {
    console.log('')
    console.log('Проблем с капитанством не найдено.')
    return
  }

  console.log('')
  teamsWithIssues.forEach((team, index) => {
    console.log(
      `${index + 1}. [${team.issueCode}] ${team.teamName || 'Без названия'} (${team.teamId})`,
    )
    console.log(
      `   Участников: ${team.membershipsCount}, капитанов: ${team.captainCount}, локация: ${team.location || 'n/a'}`,
    )

    team.members.forEach((member) => {
      const name = member.userName || member.username || 'Без имени'
      const missingMark = member.hasLinkedUser ? '' : ' [user_missing]'
      console.log(
        `   - ${member.membershipId}: role=${member.role}, userId=${member.userId || 'n/a'}, telegramId=${member.userTelegramId ?? 'n/a'}, name=${name}${missingMark}`,
      )
    })
  })
}

async function main() {
  loadEnv()

  const options = parseArgs()
  const mongoUri = process.env.MONGODB_URI
  const dbName = process.env.MONGODB_GLOBAL_DBNAME

  if (!mongoUri) {
    throw new Error('MONGODB_URI is not set')
  }

  if (!dbName) {
    throw new Error('MONGODB_GLOBAL_DBNAME is not set')
  }

  const connection = await mongoose.createConnection(mongoUri, { dbName }).asPromise()

  try {
    const teamsUsersCollection = connection.collection('teamsusers')
    const teamsCollection = connection.collection('teams')
    const usersCollection = connection.collection('users')

    const membershipsFilter = options.teamId ? { teamId: options.teamId } : {}
    const memberships = await teamsUsersCollection
      .find(membershipsFilter, {
        projection: {
          _id: 1,
          teamId: 1,
          userId: 1,
          userTelegramId: 1,
          role: 1,
        },
      })
      .toArray()

    const teamIds = Array.from(
      new Set(
        memberships
          .map((item) => (item?.teamId ? String(item.teamId).trim() : ''))
          .filter(Boolean),
      ),
    )
    const userIds = Array.from(
      new Set(
        memberships
          .map((item) => (item?.userId ? String(item.userId).trim() : ''))
          .filter(Boolean),
      ),
    )

    const objectIdTeamIds = teamIds
      .filter((teamId) => mongoose.Types.ObjectId.isValid(teamId))
      .map((teamId) => new mongoose.Types.ObjectId(teamId))
    const objectIdUserIds = userIds
      .filter((userId) => mongoose.Types.ObjectId.isValid(userId))
      .map((userId) => new mongoose.Types.ObjectId(userId))

    const [teams, users] = await Promise.all([
      objectIdTeamIds.length
        ? teamsCollection
            .find(
              { _id: { $in: objectIdTeamIds } },
              { projection: { _id: 1, name: 1, location: 1 } },
            )
            .toArray()
        : [],
      objectIdUserIds.length
        ? usersCollection
            .find(
              { _id: { $in: objectIdUserIds } },
              { projection: { _id: 1, name: 1, username: 1 } },
            )
            .toArray()
        : [],
    ])

    const report = analyzeTeamCaptainIntegrity({
      teams,
      memberships,
      users,
      limit: options.limit,
    })

    if (options.json) {
      console.log(
        JSON.stringify(
          {
            success: true,
            options,
            data: report,
          },
          null,
          2,
        ),
      )
    } else {
      printTextReport(report, options)
    }

    if (options.failOnIssues && report.summary.teamsWithIssuesCount > 0) {
      process.exitCode = 2
    }
  } finally {
    await connection.close()
  }
}

main().catch((error) => {
  console.error('Failed to audit team captains', error)
  process.exitCode = 1
})
