/* eslint-disable no-console */
const fs = require('fs')
const path = require('path')
const mongoose = require('mongoose')

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
        (value.startsWith("'") && value.endsWith("'")) ||
        (value.startsWith('"') && value.endsWith('"'))
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
    } catch (_dotenvError) {
      if (fs.existsSync(envFilePath)) {
        const raw = fs.readFileSync(envFilePath, 'utf8')
        applyEnvLines(raw)
      }
    }
  } catch (_error) {
    // optional
  }
}

const parseArgs = () => {
  const args = process.argv.slice(2)
  const result = {
    gameId: '',
    dbName: process.env.MONGODB_GLOBAL_DBNAME || '',
    strict: false,
  }

  args.forEach((arg) => {
    if (arg === '--strict') {
      result.strict = true
      return
    }

    if (arg.startsWith('--gameId=')) {
      result.gameId = arg.replace('--gameId=', '').trim()
      return
    }

    if (arg.startsWith('--dbName=')) {
      result.dbName = arg.replace('--dbName=', '').trim()
    }
  })

  return result
}

const printUsage = () => {
  console.log('Использование:')
  console.log(
    '  node scripts/checkGameTeamAccessReady.js --gameId=<GAME_ID> [--dbName=<DB_NAME>] [--strict]',
  )
  console.log('')
  console.log('Примеры:')
  console.log(
    '  node scripts/checkGameTeamAccessReady.js --gameId=69e345b86ff4b913ca79941c',
  )
  console.log(
    '  node scripts/checkGameTeamAccessReady.js --gameId=69e345b86ff4b913ca79941c --strict',
  )
}

const isValidObjectId = (value) =>
  typeof value === 'string' && /^[a-fA-F0-9]{24}$/.test(value.trim())

const toIdString = (value) => {
  if (!value) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'object' && value.toString) return String(value)
  return ''
}

const main = async () => {
  loadEnv()

  const { gameId, dbName, strict } = parseArgs()
  if (!gameId || !isValidObjectId(gameId)) {
    printUsage()
    throw new Error('Нужно передать корректный --gameId (24 hex)')
  }

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI не задан')
  }
  if (!dbName) {
    throw new Error(
      'DB name не задан. Передайте --dbName или задайте MONGODB_GLOBAL_DBNAME',
    )
  }

  const connection = await mongoose
    .createConnection(process.env.MONGODB_URI, { dbName })
    .asPromise()

  try {
    const Games = connection.collection('games')
    const GamesTeams = connection.collection('gamesteams')
    const Teams = connection.collection('teams')
    const TeamsUsers = connection.collection('teamsusers')
    const Users = connection.collection('users')

    const game = await Games.findOne(
      { _id: new mongoose.Types.ObjectId(gameId) },
      { projection: { _id: 1, name: 1, status: 1, location: 1 } },
    )

    if (!game) {
      throw new Error(`Игра ${gameId} не найдена в БД ${dbName}`)
    }

    const gameTeams = await GamesTeams.find({ gameId }).toArray()
    const teamIds = Array.from(
      new Set(
        gameTeams
          .map((item) => toIdString(item?.teamId).trim())
          .filter((item) => item.length > 0),
      ),
    )

    const teams = await Teams.find(
      { _id: { $in: teamIds.map((id) => new mongoose.Types.ObjectId(id)) } },
      { projection: { _id: 1, name: 1, location: 1 } },
    ).toArray()
    const teamsById = new Map(teams.map((team) => [toIdString(team._id), team]))

    const allMemberships = await TeamsUsers.find({
      teamId: { $in: teamIds },
    }).toArray()
    const membershipsByTeam = new Map()
    allMemberships.forEach((membership) => {
      const teamIdValue = toIdString(membership?.teamId).trim()
      if (!teamIdValue) return
      if (!membershipsByTeam.has(teamIdValue)) {
        membershipsByTeam.set(teamIdValue, [])
      }
      membershipsByTeam.get(teamIdValue).push(membership)
    })

    const allUserIds = Array.from(
      new Set(
        allMemberships
          .map((m) => toIdString(m?.userId).trim())
          .filter((value) => value.length > 0),
      ),
    )
    const users = allUserIds.length
      ? await Users.find(
          {
            $or: [
              { _id: { $in: allUserIds.map((id) => new mongoose.Types.ObjectId(id)) } },
              { globalUserId: { $in: allUserIds } },
            ],
          },
          { projection: { _id: 1, globalUserId: 1, role: 1, name: 1 } },
        ).toArray()
      : []
    const knownUserIds = new Set()
    users.forEach((user) => {
      const id = toIdString(user?._id).trim()
      if (id) knownUserIds.add(id)
      const globalUserId = toIdString(user?.globalUserId).trim()
      if (globalUserId) knownUserIds.add(globalUserId)
    })

    const report = {
      game: {
        id: toIdString(game._id),
        name: String(game?.name || ''),
        status: String(game?.status || ''),
        location: String(game?.location || ''),
      },
      totals: {
        gameTeams: gameTeams.length,
        uniqueTeams: teamIds.length,
      },
      problems: {
        gameTeamWithoutTeamId: [],
        teamNotFound: [],
        teamWithoutMembers: [],
        membershipWithoutUserId: [],
        membershipUserNotFound: [],
        duplicateMemberships: [],
      },
    }

    const duplicateMembershipTracker = new Map()

    gameTeams.forEach((entry) => {
      const teamIdValue = toIdString(entry?.teamId).trim()
      if (!teamIdValue) {
        report.problems.gameTeamWithoutTeamId.push({
          gameTeamId: toIdString(entry?._id),
        })
        return
      }

      const team = teamsById.get(teamIdValue)
      if (!team) {
        report.problems.teamNotFound.push({
          gameTeamId: toIdString(entry?._id),
          teamId: teamIdValue,
        })
        return
      }

      const memberships = membershipsByTeam.get(teamIdValue) || []
      if (memberships.length === 0) {
        report.problems.teamWithoutMembers.push({
          teamId: teamIdValue,
          teamName: String(team?.name || ''),
        })
        return
      }

      memberships.forEach((membership) => {
        const membershipId = toIdString(membership?._id)
        const userId = toIdString(membership?.userId).trim()

        if (!userId) {
          report.problems.membershipWithoutUserId.push({
            membershipId,
            teamId: teamIdValue,
            teamName: String(team?.name || ''),
            userTelegramId: toIdString(membership?.userTelegramId) || null,
          })
          return
        }

        const duplicateKey = `${teamIdValue}::${userId}`
        const duplicateCount = duplicateMembershipTracker.get(duplicateKey) || 0
        duplicateMembershipTracker.set(duplicateKey, duplicateCount + 1)

        if (!knownUserIds.has(userId)) {
          report.problems.membershipUserNotFound.push({
            membershipId,
            teamId: teamIdValue,
            teamName: String(team?.name || ''),
            userId,
          })
        }
      })
    })

    Array.from(duplicateMembershipTracker.entries()).forEach(([key, count]) => {
      if (count <= 1) return
      const [teamIdValue, userId] = key.split('::')
      const team = teamsById.get(teamIdValue)
      report.problems.duplicateMemberships.push({
        teamId: teamIdValue,
        teamName: String(team?.name || ''),
        userId,
        count,
      })
    })

    const strictProblemsCount =
      report.problems.gameTeamWithoutTeamId.length +
      report.problems.teamNotFound.length +
      report.problems.teamWithoutMembers.length +
      report.problems.membershipWithoutUserId.length +
      report.problems.membershipUserNotFound.length +
      report.problems.duplicateMemberships.length

    const relaxedProblemsCount =
      report.problems.gameTeamWithoutTeamId.length +
      report.problems.teamNotFound.length +
      report.problems.teamWithoutMembers.length

    const ready = strict ? strictProblemsCount === 0 : relaxedProblemsCount === 0

    console.log('='.repeat(72))
    console.log(`[checkGameTeamAccessReady] db=${dbName}`)
    console.log(
      `Игра: ${report.game.name || '(без названия)'} (${report.game.id}), статус: ${
        report.game.status || '-'
      }`,
    )
    console.log(
      `Команд в игре: ${report.totals.gameTeams} (уникальных: ${report.totals.uniqueTeams})`,
    )
    console.log(`Режим проверки: ${strict ? 'STRICT' : 'RELAXED'}`)
    console.log('-'.repeat(72))
    console.log(
      `Проблемы (блокируют в ${strict ? 'STRICT' : 'RELAXED'}): ${
        strict ? strictProblemsCount : relaxedProblemsCount
      }`,
    )
    console.log(
      `Всего найдено проблем (полный список): ${strictProblemsCount}`,
    )
    console.log('-'.repeat(72))
    Object.entries(report.problems).forEach(([name, items]) => {
      console.log(`${name}: ${items.length}`)
      if (items.length > 0) {
        items.slice(0, 20).forEach((item, index) => {
          console.log(`  ${index + 1}. ${JSON.stringify(item)}`)
        })
        if (items.length > 20) {
          console.log(`  ... и ещё ${items.length - 20}`)
        }
      }
    })
    console.log('-'.repeat(72))
    console.log(`ИТОГ: ${ready ? 'READY' : 'NOT READY'}`)
    console.log('='.repeat(72))

    if (!ready) {
      process.exitCode = 2
    }
  } finally {
    await connection.close().catch(() => {})
  }
}

main().catch((error) => {
  console.error('[checkGameTeamAccessReady] Ошибка')
  console.error(error)
  process.exitCode = 1
})

