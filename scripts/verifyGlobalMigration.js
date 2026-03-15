/* eslint-disable no-console */
const fs = require('fs')
const path = require('path')
const mongoose = require('mongoose')

try {
  require('dotenv').config()
} catch (error) {
  // optional
}

const loadEnvFromFile = (filePath) => {
  if (!fs.existsSync(filePath)) return
  const content = fs.readFileSync(filePath, 'utf8')
  const lines = content.split(/\r?\n/)

  lines.forEach((line) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return
    const index = trimmed.indexOf('=')
    if (index <= 0) return
    const key = trimmed.slice(0, index).trim()
    let value = trimmed.slice(index + 1).trim()

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    if (typeof process.env[key] === 'undefined') {
      process.env[key] = value
    }
  })
}

const resolveEnvTemplates = () => {
  const pattern = /\$\{([A-Z0-9_]+)\}/gi
  Object.keys(process.env).forEach((envKey) => {
    const rawValue = process.env[envKey]
    if (typeof rawValue !== 'string' || !rawValue.includes('${')) return

    let resolved = rawValue
    let safety = 0
    while (resolved.includes('${') && safety < 10) {
      safety += 1
      resolved = resolved.replace(pattern, (_, key) => {
        const replacement = process.env[key]
        return typeof replacement === 'string' ? replacement : ''
      })
    }
    process.env[envKey] = resolved
  })
}

loadEnvFromFile(path.resolve(process.cwd(), '.env.local'))
loadEnvFromFile(path.resolve(process.cwd(), '.env'))
resolveEnvTemplates()

const ensurePreconditions = () => {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI не задан')
  if (!process.env.MONGODB_GLOBAL_DBNAME) {
    throw new Error('MONGODB_GLOBAL_DBNAME не задан')
  }
}

const run = async () => {
  ensurePreconditions()

  const connection = await mongoose
    .createConnection(process.env.MONGODB_URI, {
      dbName: process.env.MONGODB_GLOBAL_DBNAME,
    })
    .asPromise()

  try {
    const users = connection.collection('users')
    const teamsUsers = connection.collection('teamsusers')
    const games = connection.collection('games')

    const usersTotal = await users.countDocuments({})
    const teamsUsersTotal = await teamsUsers.countDocuments({})
    const gamesTotal = await games.countDocuments({})

    const usersWithAccountLocation = await users.countDocuments({
      accountLocation: { $in: ['krsk', 'nrsk', 'ekb'] },
    })

    const usersWithoutAccountLocation = await users.countDocuments({
      $or: [{ accountLocation: { $exists: false } }, { accountLocation: null }, { accountLocation: '' }],
    })

    const duplicateTelegramIds = await users
      .aggregate([
        { $match: { telegramId: { $ne: null } } },
        { $group: { _id: '$telegramId', count: { $sum: 1 } } },
        { $match: { count: { $gt: 1 } } },
      ])
      .toArray()

    const teamsUsersWithoutUserId = await teamsUsers.countDocuments({
      $or: [{ userId: { $exists: false } }, { userId: null }, { userId: '' }],
    })

    const teamsUsersByLocation = await teamsUsers
      .aggregate([
        {
          $group: {
            _id: '$location',
            total: { $sum: 1 },
            withoutUserId: {
              $sum: {
                $cond: [
                  {
                    $or: [
                      { $eq: ['$userId', null] },
                      { $eq: ['$userId', ''] },
                      { $not: ['$userId'] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
        { $sort: { _id: 1 } },
      ])
      .toArray()

    const gamesWithLocation = await games.countDocuments({
      location: { $in: ['krsk', 'nrsk', 'ekb'] },
    })

    const gamesWithoutLocation = await games.countDocuments({
      $or: [{ location: { $exists: false } }, { location: null }, { location: '' }],
    })

    const gameResultTeamsUsersStats = await games
      .aggregate([
        { $unwind: { path: '$result.teamsUsers', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: '$location',
            totalRows: { $sum: 1 },
            withoutUserId: {
              $sum: {
                $cond: [
                  {
                    $or: [
                      { $eq: ['$result.teamsUsers.userId', null] },
                      { $eq: ['$result.teamsUsers.userId', ''] },
                      { $not: ['$result.teamsUsers.userId'] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
        { $sort: { _id: 1 } },
      ])
      .toArray()

    const report = {
      generatedAt: new Date().toISOString(),
      dbName: process.env.MONGODB_GLOBAL_DBNAME,
      totals: {
        users: usersTotal,
        teamsusers: teamsUsersTotal,
        games: gamesTotal,
      },
      users: {
        withAccountLocation: usersWithAccountLocation,
        withoutAccountLocation: usersWithoutAccountLocation,
        duplicateTelegramIdsCount: duplicateTelegramIds.length,
      },
      teamsusers: {
        withoutUserId: teamsUsersWithoutUserId,
        byLocation: teamsUsersByLocation,
      },
      games: {
        withLocation: gamesWithLocation,
        withoutLocation: gamesWithoutLocation,
        resultTeamsUsers: gameResultTeamsUsersStats,
      },
      samples: {
        duplicateTelegramIds: duplicateTelegramIds.slice(0, 20),
      },
    }

    console.log(JSON.stringify(report, null, 2))
  } finally {
    await connection.close()
  }
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Verification failed')
    console.error(error)
    process.exit(1)
  })
