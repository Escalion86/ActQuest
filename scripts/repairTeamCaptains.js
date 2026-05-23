const fs = require('fs')
const path = require('path')
const mongoose = require('mongoose')

const buildTeamCaptainRepairReport = require('../helpers/buildTeamCaptainRepairReport')
const buildTeamCaptainRepairWriteOperations = require('../helpers/buildTeamCaptainRepairWriteOperations')

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
    apply: false,
    teamId: '',
    limit: 200,
    json: false,
  }

  args.forEach((arg) => {
    if (arg === '--apply') {
      result.apply = true
      return
    }

    if (arg === '--json') {
      result.json = true
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

const toObjectIds = (values) =>
  values
    .filter((value) => mongoose.Types.ObjectId.isValid(value))
    .map((value) => new mongoose.Types.ObjectId(value))

const printTextReport = (result) => {
  console.log(`Режим: ${result.mode}`)
  console.log(`Команд с планом исправления: ${result.summary.teamsToRepairCount}`)
  console.log(`Лимит вывода: ${result.summary.limitApplied}`)
  console.log(`Усечённый вывод: ${result.summary.truncated ? 'да' : 'нет'}`)
  console.log(`Нормализаций legacy-роли: ${result.summary.legacyCaptainRoleTeamsCount}`)
  console.log(`Команд без капитана: ${result.summary.noCaptainTeamsCount}`)
  console.log(`Команд с несколькими капитанами: ${result.summary.multipleCaptainsTeamsCount}`)
  console.log(`Обновлений memberships: ${result.summary.membershipsUpdatedCount}`)

  if (!result.plans.length) {
    console.log('')
    console.log('Проблем с капитанством не найдено.')
    return
  }

  console.log('')
  result.plans.forEach((plan, index) => {
    console.log(
      `${index + 1}. [${plan.issueCode}] ${plan.teamName || 'Без названия'} (${plan.teamId})`,
    )
    if (plan.promoteMembershipId) {
      console.log(`   Назначить капитаном: ${plan.promoteMembershipId}`)
    }
    if (plan.keepCaptainMembershipId) {
      console.log(`   Оставить капитаном: ${plan.keepCaptainMembershipId}`)
    }
    if (plan.demoteMembershipIds.length > 0) {
      console.log(`   Понизить до participant: ${plan.demoteMembershipIds.join(', ')}`)
    }
    if (plan.normalizeMembershipIds.length > 0) {
      console.log(`   Нормализовать роль в captain: ${plan.normalizeMembershipIds.join(', ')}`)
    }
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

    const membershipFilter = options.teamId ? { teamId: options.teamId } : {}
    const memberships = await teamsUsersCollection
      .find(membershipFilter, {
        projection: {
          _id: 1,
          teamId: 1,
          role: 1,
          createdAt: 1,
        },
      })
      .toArray()

    const teamIds = Array.from(
      new Set(
        memberships
          .map((membership) =>
            membership?.teamId ? String(membership.teamId).trim() : '',
          )
          .filter(Boolean),
      ),
    )

    const teams = teamIds.length
      ? await teamsCollection
          .find(
            { _id: { $in: toObjectIds(teamIds) } },
            { projection: { _id: 1, name: 1, location: 1 } },
          )
          .toArray()
      : []

    const report = buildTeamCaptainRepairReport({
      teams,
      memberships,
      users: [],
      limit: options.limit,
    })

    let membershipsUpdatedCount = 0
    if (options.apply && report.plans.length > 0) {
      const writeOperations = buildTeamCaptainRepairWriteOperations({
        plans: report.plans,
        mongoose,
      })
      if (writeOperations.length > 0) {
        const writeResult = await teamsUsersCollection.bulkWrite(writeOperations, {
          ordered: false,
        })
        membershipsUpdatedCount = Number(writeResult.modifiedCount || 0)
      }
    }

    const result = {
      mode: options.apply ? 'APPLY' : 'DRY-RUN',
      summary: {
        ...report.summary,
        membershipsUpdatedCount,
      },
      plans: report.plans,
    }

    if (options.json) {
      console.log(JSON.stringify(result, null, 2))
    } else {
      printTextReport(result)
    }
  } finally {
    await connection.close()
  }
}

main().catch((error) => {
  console.error('Failed to repair team captains', error)
  process.exitCode = 1
})
