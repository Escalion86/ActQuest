/* eslint-disable no-console */
const mongoose = require('mongoose')

try {
  require('dotenv').config()
} catch (error) {
  // dotenv is optional in this script runtime
}

const DB_NAME_BY_LOCATION = {
  dev: process.env.MONGODB_DEV_DBNAME,
  krsk: process.env.MONGODB_KRSK_DBNAME,
  nrsk: process.env.MONGODB_NRSK_DBNAME,
  ekb: process.env.MONGODB_EKB_DBNAME,
}

const parseArgs = () => {
  const args = process.argv.slice(2)
  const result = {
    location: null,
    dryRun: false,
    limit: null,
  }

  args.forEach((arg) => {
    if (arg === '--dry-run') {
      result.dryRun = true
      return
    }

    if (arg.startsWith('--location=')) {
      result.location = arg.replace('--location=', '').trim()
      return
    }

    if (arg.startsWith('--limit=')) {
      const value = Number(arg.replace('--limit=', '').trim())
      if (Number.isFinite(value) && value > 0) {
        result.limit = value
      }
    }
  })

  return result
}

const toStringId = (value) => {
  if (!value) return null
  if (typeof value === 'string') return value
  if (typeof value.toString === 'function') {
    const str = value.toString()
    return str && str !== '[object Object]' ? str : null
  }
  return null
}

const runLocation = async ({ location, dbName, dryRun, limit }) => {
  const connection = await mongoose
    .createConnection(process.env.MONGODB_URI, { dbName })
    .asPromise()

  try {
    const teamsUsersCollection = connection.collection('teamsusers')
    const usersCollection = connection.collection('users')

    const query = {
      $and: [
        {
          $or: [{ userId: { $exists: false } }, { userId: null }, { userId: '' }],
        },
        { userTelegramId: { $exists: true, $ne: null } },
      ],
    }

    const docs = await teamsUsersCollection
      .find(query, {
        projection: { _id: 1, userTelegramId: 1, userId: 1 },
      })
      .limit(limit || 0)
      .toArray()

    if (docs.length === 0) {
      console.log(`[${location}] Нет документов для миграции`)
      return {
        location,
        scanned: 0,
        updated: 0,
        missingUsers: 0,
      }
    }

    const telegramIds = Array.from(
      new Set(
        docs
          .map((doc) => doc.userTelegramId)
          .filter((value) => Number.isFinite(Number(value)))
          .map((value) => Number(value)),
      ),
    )

    const users = await usersCollection
      .find(
        { telegramId: { $in: telegramIds } },
        { projection: { _id: 1, telegramId: 1 } },
      )
      .toArray()

    const userIdByTelegramId = users.reduce((acc, user) => {
      const telegramId = Number(user?.telegramId)
      const userId = toStringId(user?._id)
      if (Number.isFinite(telegramId) && userId) {
        acc[telegramId] = userId
      }
      return acc
    }, {})

    const operations = []
    let missingUsers = 0

    docs.forEach((doc) => {
      const telegramId = Number(doc.userTelegramId)
      const userId = userIdByTelegramId[telegramId]

      if (!userId) {
        missingUsers += 1
        return
      }

      operations.push({
        updateOne: {
          filter: { _id: doc._id },
          update: { $set: { userId } },
        },
      })
    })

    if (dryRun) {
      console.log(
        `[${location}] dry-run: найдено ${docs.length}, к обновлению ${operations.length}, без пользователя ${missingUsers}`,
      )
      return {
        location,
        scanned: docs.length,
        updated: operations.length,
        missingUsers,
      }
    }

    if (operations.length === 0) {
      console.log(`[${location}] Нет операций обновления`)
      return {
        location,
        scanned: docs.length,
        updated: 0,
        missingUsers,
      }
    }

    const result = await teamsUsersCollection.bulkWrite(operations, {
      ordered: false,
    })

    const updated = result.modifiedCount || 0
    console.log(
      `[${location}] обновлено ${updated} из ${docs.length}, без пользователя ${missingUsers}`,
    )

    return {
      location,
      scanned: docs.length,
      updated,
      missingUsers,
    }
  } finally {
    await connection.close()
  }
}

const main = async () => {
  const { location, dryRun, limit } = parseArgs()
  const mongoUri = process.env.MONGODB_URI

  if (!mongoUri) {
    throw new Error('MONGODB_URI не задан в окружении')
  }

  const locations = location ? [location] : Object.keys(DB_NAME_BY_LOCATION)
  const summaries = []

  for (const item of locations) {
    const dbName = DB_NAME_BY_LOCATION[item]
    if (!dbName) {
      console.log(`[${item}] Пропущено: нет DBNAME переменной в окружении`)
      continue
    }

    const summary = await runLocation({
      location: item,
      dbName,
      dryRun,
      limit,
    })
    summaries.push(summary)
  }

  const totals = summaries.reduce(
    (acc, summary) => {
      acc.scanned += summary.scanned
      acc.updated += summary.updated
      acc.missingUsers += summary.missingUsers
      return acc
    },
    { scanned: 0, updated: 0, missingUsers: 0 },
  )

  console.log('---')
  console.log('Итог:')
  console.log(`Проверено: ${totals.scanned}`)
  console.log(`Обновлено: ${totals.updated}`)
  console.log(`Без соответствия user: ${totals.missingUsers}`)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Ошибка миграции teamsusers -> userId')
    console.error(error)
    process.exit(1)
  })
