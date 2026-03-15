/* eslint-disable no-console */
const mongoose = require('mongoose')
const fs = require('fs')
const path = require('path')

try {
  require('dotenv').config()
} catch (error) {
  // dotenv optional
}

const loadEnvFromFile = (filePath) => {
  if (!fs.existsSync(filePath)) return
  const fileContent = fs.readFileSync(filePath, 'utf8')
  const lines = fileContent.split(/\r?\n/)

  lines.forEach((line) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return
    const separatorIndex = trimmed.indexOf('=')
    if (separatorIndex <= 0) return

    const key = trimmed.slice(0, separatorIndex).trim()
    let value = trimmed.slice(separatorIndex + 1).trim()
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

loadEnvFromFile(path.resolve(process.cwd(), '.env.local'))
loadEnvFromFile(path.resolve(process.cwd(), '.env'))

const resolveEnvTemplates = () => {
  const templatePattern = /\$\{([A-Z0-9_]+)\}/gi
  const envKeys = Object.keys(process.env)

  envKeys.forEach((envKey) => {
    const rawValue = process.env[envKey]
    if (typeof rawValue !== 'string' || !rawValue.includes('${')) return

    let resolved = rawValue
    let safety = 0
    while (resolved.includes('${') && safety < 10) {
      safety += 1
      resolved = resolved.replace(templatePattern, (_, key) => {
        const replacement = process.env[key]
        return typeof replacement === 'string' ? replacement : ''
      })
    }

    process.env[envKey] = resolved
  })
}

resolveEnvTemplates()

const DB_NAME_BY_LOCATION = {
  dev: process.env.MONGODB_DEV_DBNAME,
  krsk: process.env.MONGODB_KRSK_DBNAME,
  nrsk: process.env.MONGODB_NRSK_DBNAME,
  ekb: process.env.MONGODB_EKB_DBNAME,
}

const normalizeNumber = (value) => {
  if (value === null || typeof value === 'undefined') return null
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

const toStringId = (value) => {
  if (!value) return null
  if (typeof value === 'string') return value
  if (typeof value?.toString === 'function') {
    const str = value.toString()
    return str && str !== '[object Object]' ? str : null
  }
  return null
}

const normalizePhone = (value) => {
  if (value === null || typeof value === 'undefined') return null
  const digits = String(value).replace(/\D/g, '')
  if (!digits) return null
  const num = Number(digits)
  return Number.isFinite(num) ? num : null
}

const normalizeText = (value) => {
  if (typeof value !== 'string') return ''
  return value.trim()
}

const parseArgs = () => {
  const args = process.argv.slice(2)
  const parsed = {
    location: null,
    limit: null,
  }

  args.forEach((arg) => {
    if (arg.startsWith('--location=')) {
      parsed.location = arg.replace('--location=', '').trim()
    }

    if (arg.startsWith('--limit=')) {
      const value = Number(arg.replace('--limit=', '').trim())
      if (Number.isFinite(value) && value > 0) {
        parsed.limit = value
      }
    }
  })

  return parsed
}

const loadUsersByLocation = async ({ location, dbName, limit }) => {
  const connection = await mongoose
    .createConnection(process.env.MONGODB_URI, { dbName })
    .asPromise()

  try {
    const cursor = connection.collection('users').find(
      {},
      {
        projection: {
          _id: 1,
          telegramId: 1,
          vkId: 1,
          phone: 1,
          name: 1,
          username: 1,
          authMethod: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      },
    )

    if (limit) {
      cursor.limit(limit)
    }

    const docs = await cursor.toArray()

    return docs.map((doc) => ({
      legacyId: toStringId(doc._id),
      location,
      telegramId: normalizeNumber(doc.telegramId),
      vkId: normalizeNumber(doc.vkId),
      phone: normalizePhone(doc.phone),
      name: normalizeText(doc.name),
      username: normalizeText(doc.username),
      authMethod: normalizeText(doc.authMethod),
      createdAt: doc.createdAt || null,
      updatedAt: doc.updatedAt || null,
    }))
  } finally {
    await connection.close()
  }
}

const addToIndex = (index, key, user) => {
  if (!key) return
  if (!index[key]) {
    index[key] = []
  }
  index[key].push(user)
}

const findConflicts = (usersByKey) => {
  const conflicts = []
  Object.entries(usersByKey).forEach(([key, users]) => {
    const locations = Array.from(new Set(users.map((item) => item.location)))
    if (users.length <= 1 || locations.length <= 1) return

    conflicts.push({
      key,
      usersCount: users.length,
      locations,
      users: users.map((item) => ({
        legacyId: item.legacyId,
        location: item.location,
        name: item.name,
        username: item.username,
        authMethod: item.authMethod,
      })),
    })
  })
  return conflicts
}

const main = async () => {
  const { location, limit } = parseArgs()
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI не задан в окружении')
  }

  const selectedLocations = location
    ? [location]
    : Object.keys(DB_NAME_BY_LOCATION)

  const allUsers = []
  for (const key of selectedLocations) {
    const dbName = DB_NAME_BY_LOCATION[key]
    if (!dbName) {
      console.log(`[${key}] пропуск: не задано имя БД`)
      continue
    }

    const users = await loadUsersByLocation({ location: key, dbName, limit })
    allUsers.push(...users)
    console.log(`[${key}] users: ${users.length}`)
  }

  const byPhone = {}
  const byVkId = {}
  const byTelegramId = {}

  allUsers.forEach((user) => {
    addToIndex(byPhone, user.phone ? String(user.phone) : null, user)
    addToIndex(byVkId, user.vkId ? String(user.vkId) : null, user)
    addToIndex(
      byTelegramId,
      user.telegramId ? String(user.telegramId) : null,
      user,
    )
  })

  const phoneConflicts = findConflicts(byPhone)
  const vkConflicts = findConflicts(byVkId)
  const telegramConflicts = findConflicts(byTelegramId)

  const noStrongId = allUsers.filter(
    (user) => !user.phone && !user.vkId && !user.telegramId,
  )

  console.log('---')
  console.log(`Всего пользователей: ${allUsers.length}`)
  console.log(`Конфликты phone между городами: ${phoneConflicts.length}`)
  console.log(`Конфликты vkId между городами: ${vkConflicts.length}`)
  console.log(`Конфликты telegramId между городами: ${telegramConflicts.length}`)
  console.log(`Пользователи без phone/vkId/telegramId: ${noStrongId.length}`)
  console.log('---')

  const report = {
    generatedAt: new Date().toISOString(),
    locations: selectedLocations,
    totalUsers: allUsers.length,
    conflicts: {
      phone: phoneConflicts,
      vkId: vkConflicts,
      telegramId: telegramConflicts,
    },
    noStrongIdUsers: noStrongId.map((user) => ({
      legacyId: user.legacyId,
      location: user.location,
      name: user.name,
      username: user.username,
      authMethod: user.authMethod,
    })),
  }

  console.log(JSON.stringify(report, null, 2))
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Ошибка аудита глобальной миграции пользователей')
    console.error(error)
    process.exit(1)
  })
