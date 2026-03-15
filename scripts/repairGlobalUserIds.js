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
    const idx = trimmed.indexOf('=')
    if (idx <= 0) return
    const key = trimmed.slice(0, idx).trim()
    let value = trimmed.slice(idx + 1).trim()
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
    const raw = process.env[envKey]
    if (typeof raw !== 'string' || !raw.includes('${')) return
    let resolved = raw
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
  if (!process.env.MONGODB_GLOBAL_DBNAME) throw new Error('MONGODB_GLOBAL_DBNAME не задан')
}

const normalizeTelegramId = (value) => {
  if (value === null || typeof value === 'undefined') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const parseArgs = () => {
  const args = process.argv.slice(2)
  return {
    dryRun: args.includes('--dry-run'),
  }
}

const run = async () => {
  ensurePreconditions()
  const { dryRun } = parseArgs()

  const connection = await mongoose
    .createConnection(process.env.MONGODB_URI, {
      dbName: process.env.MONGODB_GLOBAL_DBNAME,
    })
    .asPromise()

  try {
    const users = connection.collection('users')
    const teamsUsers = connection.collection('teamsusers')
    const games = connection.collection('games')

    const usersWithTelegram = await users
      .find(
        { telegramId: { $ne: null } },
        { projection: { _id: 1, telegramId: 1 } },
      )
      .toArray()

    const userIdByTelegramId = new Map()
    usersWithTelegram.forEach((user) => {
      const telegramId = normalizeTelegramId(user?.telegramId)
      if (telegramId === null) return
      userIdByTelegramId.set(telegramId, String(user._id))
    })

    const unresolvedTeamsUsers = []
    const teamsUsersDocs = await teamsUsers
      .find({
        $or: [{ userId: { $exists: false } }, { userId: null }, { userId: '' }],
      })
      .toArray()

    const teamsUsersOps = []
    teamsUsersDocs.forEach((doc) => {
      const telegramId = normalizeTelegramId(doc?.userTelegramId)
      if (telegramId === null) {
        unresolvedTeamsUsers.push({
          _id: String(doc._id),
          location: doc.location || null,
          userTelegramId: doc.userTelegramId ?? null,
          reason: 'INVALID_OR_MISSING_TELEGRAM_ID',
        })
        return
      }

      const userId = userIdByTelegramId.get(telegramId) || null
      if (!userId) {
        unresolvedTeamsUsers.push({
          _id: String(doc._id),
          location: doc.location || null,
          userTelegramId: telegramId,
          reason: 'USER_NOT_FOUND_BY_TELEGRAM_ID',
        })
        return
      }

      teamsUsersOps.push({
        updateOne: {
          filter: { _id: doc._id },
          update: { $set: { userId } },
        },
      })
    })

    if (!dryRun && teamsUsersOps.length > 0) {
      await teamsUsers.bulkWrite(teamsUsersOps, { ordered: false })
    }

    const unresolvedGameResultRows = []
    const gamesDocs = await games
      .find({
        'result.teamsUsers': { $exists: true, $ne: [] },
      })
      .toArray()

    let gamesPatched = 0
    for (const game of gamesDocs) {
      const list = Array.isArray(game?.result?.teamsUsers) ? game.result.teamsUsers : []
      if (list.length === 0) continue

      let changed = false
      const patched = list.map((item, index) => {
        const hasUserId = typeof item?.userId === 'string' && item.userId.trim().length > 0
        if (hasUserId) return item

        const telegramId = normalizeTelegramId(item?.userTelegramId)
        if (telegramId === null) {
          unresolvedGameResultRows.push({
            gameId: String(game._id),
            location: game.location || null,
            index,
            userTelegramId: item?.userTelegramId ?? null,
            reason: 'INVALID_OR_MISSING_TELEGRAM_ID',
          })
          return item
        }

        const userId = userIdByTelegramId.get(telegramId) || null
        if (!userId) {
          unresolvedGameResultRows.push({
            gameId: String(game._id),
            location: game.location || null,
            index,
            userTelegramId: telegramId,
            reason: 'USER_NOT_FOUND_BY_TELEGRAM_ID',
          })
          return item
        }

        changed = true
        return { ...item, userId }
      })

      if (changed) {
        gamesPatched += 1
        if (!dryRun) {
          await games.updateOne(
            { _id: game._id },
            { $set: { 'result.teamsUsers': patched } },
          )
        }
      }
    }

    const report = {
      generatedAt: new Date().toISOString(),
      dbName: process.env.MONGODB_GLOBAL_DBNAME,
      dryRun,
      teamsusers: {
        candidates: teamsUsersDocs.length,
        patched: teamsUsersOps.length,
        unresolved: unresolvedTeamsUsers.length,
      },
      gamesResultTeamsUsers: {
        gamesScanned: gamesDocs.length,
        gamesPatched,
        unresolvedRows: unresolvedGameResultRows.length,
      },
      unresolved: {
        teamsusers: unresolvedTeamsUsers.slice(0, 200),
        gamesResultTeamsUsers: unresolvedGameResultRows.slice(0, 200),
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
    console.error('Repair failed')
    console.error(error)
    process.exit(1)
  })
