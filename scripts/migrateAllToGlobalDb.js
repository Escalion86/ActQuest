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

const DEFAULT_LOCATIONS = ['krsk', 'nrsk', 'ekb']

const DB_NAME_BY_LOCATION = {
  dev: process.env.MONGODB_DEV_DBNAME,
  krsk: process.env.MONGODB_KRSK_DBNAME,
  nrsk: process.env.MONGODB_NRSK_DBNAME,
  ekb: process.env.MONGODB_EKB_DBNAME,
}

const COLLECTIONS_AFTER_TEAMS_USERS = [
  'teams',
  'gamesteams',
  'games',
  'lastcommands',
  'sitesettings',
  'usersgamespayments',
  'notifications',
  'gamespayments',
]

const parseArgs = () => {
  const args = process.argv.slice(2)
  const parsed = {
    dryRun: false,
    includeDev: false,
    locations: null,
    limit: null,
  }

  args.forEach((arg) => {
    if (arg === '--dry-run') parsed.dryRun = true
    if (arg === '--include-dev') parsed.includeDev = true
    if (arg.startsWith('--locations=')) {
      const raw = arg.replace('--locations=', '').trim()
      parsed.locations = raw
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    }
    if (arg.startsWith('--limit=')) {
      const value = Number(arg.replace('--limit=', '').trim())
      if (Number.isFinite(value) && value > 0) parsed.limit = value
    }
  })

  return parsed
}

const normalizeTelegramId = (value) => {
  if (value === null || typeof value === 'undefined') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
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

const buildLegacyKey = (location, legacyId) => `${location}:${legacyId}`

const connectToDb = async (dbName) =>
  mongoose.createConnection(process.env.MONGODB_URI, { dbName }).asPromise()

const ensurePreconditions = () => {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI не задан')
  }
  if (!process.env.MONGODB_GLOBAL_DBNAME) {
    throw new Error('MONGODB_GLOBAL_DBNAME не задан')
  }
}

const migrateUsers = async ({
  sourceDb,
  globalDb,
  location,
  dryRun,
  limit,
  globalUserIdByTelegramId,
  globalUserIdByLegacyKey,
}) => {
  const usersCollection = sourceDb.collection('users')
  const globalUsersCollection = globalDb.collection('users')

  const cursor = usersCollection.find({})
  if (limit) cursor.limit(limit)
  const users = await cursor.toArray()

  let inserted = 0
  let skippedDuplicates = 0
  let mapped = 0

  for (const user of users) {
    const legacyId = toStringId(user?._id)
    if (!legacyId) continue

    const telegramId = normalizeTelegramId(user?.telegramId)
    let targetGlobalId = null

    if (telegramId !== null) {
      if (!globalUserIdByTelegramId.has(telegramId)) {
        const existingGlobal = await globalUsersCollection.findOne(
          { telegramId },
          { projection: { _id: 1 } },
        )
        if (existingGlobal?._id) {
          globalUserIdByTelegramId.set(telegramId, toStringId(existingGlobal._id))
        }
      }

      const cachedGlobalId = globalUserIdByTelegramId.get(telegramId) || null
      if (cachedGlobalId) {
        skippedDuplicates += 1
        targetGlobalId = cachedGlobalId
      }
    }

    if (!targetGlobalId) {
      const targetDoc = { ...user }
      targetDoc._id = new mongoose.Types.ObjectId()
      targetDoc.accountLocation = location
      targetDoc.legacyLocation = location
      targetDoc.legacyUserId = legacyId

      if (!dryRun) {
        await globalUsersCollection.insertOne(targetDoc)
      }

      targetGlobalId = toStringId(targetDoc._id)
      inserted += 1

      if (telegramId !== null) {
        globalUserIdByTelegramId.set(telegramId, targetGlobalId)
      }
    }

    globalUserIdByLegacyKey.set(buildLegacyKey(location, legacyId), targetGlobalId)
    mapped += 1
  }

  return {
    total: users.length,
    inserted,
    skippedDuplicates,
    mapped,
  }
}

const migrateTeamsUsers = async ({
  sourceDb,
  globalDb,
  location,
  dryRun,
  limit,
  globalUserIdByTelegramId,
  globalUserIdByLegacyKey,
}) => {
  const sourceCollection = sourceDb.collection('teamsusers')
  const targetCollection = globalDb.collection('teamsusers')

  const cursor = sourceCollection.find({})
  if (limit) cursor.limit(limit)
  const docs = await cursor.toArray()

  const operations = []
  let withResolvedUserId = 0

  docs.forEach((doc) => {
    const nextDoc = { ...doc, location }
    const telegramId = normalizeTelegramId(doc?.userTelegramId)
    const legacyUserKey = doc?.userId
      ? buildLegacyKey(location, String(doc.userId))
      : null

    let resolvedUserId = null
    if (telegramId !== null && globalUserIdByTelegramId.has(telegramId)) {
      resolvedUserId = globalUserIdByTelegramId.get(telegramId)
    } else if (legacyUserKey && globalUserIdByLegacyKey.has(legacyUserKey)) {
      resolvedUserId = globalUserIdByLegacyKey.get(legacyUserKey)
    }

    if (resolvedUserId) {
      nextDoc.userId = resolvedUserId
      withResolvedUserId += 1
    } else if (!nextDoc.userId) {
      nextDoc.userId = null
    }

    operations.push({
      updateOne: {
        filter: { _id: nextDoc._id },
        update: { $setOnInsert: nextDoc },
        upsert: true,
      },
    })
  })

  if (!dryRun && operations.length > 0) {
    await targetCollection.bulkWrite(operations, { ordered: false })
  }

  return {
    total: docs.length,
    insertedOrExisting: operations.length,
    withResolvedUserId,
  }
}

const patchGameResultTeamsUsers = (gameDoc, globalUserIdByTelegramId) => {
  if (!gameDoc?.result || !Array.isArray(gameDoc.result.teamsUsers)) {
    return gameDoc
  }

  const nextDoc = { ...gameDoc }
  const result = { ...(nextDoc.result || {}) }
  result.teamsUsers = result.teamsUsers.map((item) => {
    const nextItem = { ...item }
    const telegramId = normalizeTelegramId(item?.userTelegramId)
    if (telegramId !== null && globalUserIdByTelegramId.has(telegramId)) {
      nextItem.userId = globalUserIdByTelegramId.get(telegramId)
    }
    return nextItem
  })
  nextDoc.result = result
  return nextDoc
}

const migrateGenericCollection = async ({
  sourceDb,
  globalDb,
  location,
  collectionName,
  dryRun,
  limit,
  globalUserIdByTelegramId,
}) => {
  const sourceCollection = sourceDb.collection(collectionName)
  const targetCollection = globalDb.collection(collectionName)

  const cursor = sourceCollection.find({})
  if (limit) cursor.limit(limit)
  const docs = await cursor.toArray()

  const operations = docs.map((doc) => {
    let nextDoc = { ...doc, location }

    if (collectionName === 'games') {
      nextDoc = patchGameResultTeamsUsers(nextDoc, globalUserIdByTelegramId)
    }

    return {
      updateOne: {
        filter: { _id: nextDoc._id },
        update: { $setOnInsert: nextDoc },
        upsert: true,
      },
    }
  })

  if (!dryRun && operations.length > 0) {
    await targetCollection.bulkWrite(operations, { ordered: false })
  }

  return {
    total: docs.length,
    insertedOrExisting: operations.length,
  }
}

const main = async () => {
  ensurePreconditions()
  const { dryRun, includeDev, locations: customLocations, limit } = parseArgs()

  const locations = customLocations && customLocations.length > 0
    ? customLocations
    : includeDev
      ? ['dev', ...DEFAULT_LOCATIONS]
      : DEFAULT_LOCATIONS

  const globalDb = await connectToDb(process.env.MONGODB_GLOBAL_DBNAME)
  const globalUserIdByTelegramId = new Map()
  const globalUserIdByLegacyKey = new Map()

  const summary = {
    dryRun,
    locations,
    users: {},
    teamsUsers: {},
    collections: {},
  }

  try {
    for (const location of locations) {
      const sourceDbName = DB_NAME_BY_LOCATION[location]
      if (!sourceDbName) {
        console.log(`[${location}] Пропущено: не задано имя БД`)
        continue
      }

      console.log(`\n=== ${location} (${sourceDbName}) ===`)
      const sourceDb = await connectToDb(sourceDbName)

      try {
        const usersResult = await migrateUsers({
          sourceDb,
          globalDb,
          location,
          dryRun,
          limit,
          globalUserIdByTelegramId,
          globalUserIdByLegacyKey,
        })
        summary.users[location] = usersResult
        console.log(
          `[${location}] users: total=${usersResult.total}, inserted=${usersResult.inserted}, duplicates=${usersResult.skippedDuplicates}, mapped=${usersResult.mapped}`,
        )

        const teamsUsersResult = await migrateTeamsUsers({
          sourceDb,
          globalDb,
          location,
          dryRun,
          limit,
          globalUserIdByTelegramId,
          globalUserIdByLegacyKey,
        })
        summary.teamsUsers[location] = teamsUsersResult
        console.log(
          `[${location}] teamsusers: total=${teamsUsersResult.total}, resolvedUserId=${teamsUsersResult.withResolvedUserId}`,
        )

        for (const collectionName of COLLECTIONS_AFTER_TEAMS_USERS) {
          const result = await migrateGenericCollection({
            sourceDb,
            globalDb,
            location,
            collectionName,
            dryRun,
            limit,
            globalUserIdByTelegramId,
          })

          if (!summary.collections[collectionName]) {
            summary.collections[collectionName] = {}
          }
          summary.collections[collectionName][location] = result
          console.log(
            `[${location}] ${collectionName}: total=${result.total}`,
          )
        }
      } finally {
        await sourceDb.close()
      }
    }

    console.log('\n--- MIGRATION SUMMARY ---')
    console.log(JSON.stringify(summary, null, 2))
  } finally {
    await globalDb.close()
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Migration failed')
    console.error(error)
    process.exit(1)
  })
