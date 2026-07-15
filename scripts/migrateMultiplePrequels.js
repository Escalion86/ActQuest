const fs = require('fs')
const path = require('path')
const mongoose = require('mongoose')

const isApply = process.argv.includes('--apply')

const loadEnv = (fileName) => {
  const filePath = path.resolve(process.cwd(), fileName)
  if (!fs.existsSync(filePath)) return
  fs.readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .forEach((line) => {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) return
      const separator = trimmed.indexOf('=')
      if (separator <= 0) return
      const key = trimmed.slice(0, separator).trim()
      let value = trimmed.slice(separator + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) value = value.slice(1, -1)
      if (typeof process.env[key] === 'undefined') process.env[key] = value
    })
}

loadEnv('.env.local')
loadEnv('.env')

const hasLegacyPrequel = (value) =>
  value &&
  typeof value === 'object' &&
  (value.enabled ||
    value.openAt ||
    value.description ||
    value.descriptionRich ||
    (Array.isArray(value.bonusCodes) && value.bonusCodes.length > 0) ||
    (Array.isArray(value.penaltyCodes) && value.penaltyCodes.length > 0))

const migrateProgress = (progress, prequelId) => ({
  ...progress,
  prequelId,
  foundMainCodes: Array.isArray(progress?.foundMainCodes)
    ? progress.foundMainCodes
    : [],
  completedAt:
    progress?.completedAt || (progress?.isClosed ? progress?.lastSubmittedAt || null : null),
  completedSource:
    progress?.completedSource || (progress?.isClosed ? 'codes' : null),
  completionBonusApplied:
    typeof progress?.completionBonusApplied === 'boolean'
      ? progress.completionBonusApplied
      : Boolean(progress?.isClosed),
})

const run = async () => {
  if (!process.env.MONGODB_URI || !process.env.MONGODB_GLOBAL_DBNAME) {
    throw new Error('Не заданы MONGODB_URI или MONGODB_GLOBAL_DBNAME')
  }
  const connection = await mongoose
    .createConnection(process.env.MONGODB_URI, {
      dbName: process.env.MONGODB_GLOBAL_DBNAME,
    })
    .asPromise()

  try {
    const Games = connection.collection('games')
    const GamesTeams = connection.collection('gamesteams')
    const games = await Games.find({}).project({ prequel: 1, prequels: 1 }).toArray()
    const prequelIdByGameId = new Map()
    const gameOperations = []

    games.forEach((game) => {
      const existing = Array.isArray(game.prequels) ? game.prequels : []
      if (existing.length > 0) {
        prequelIdByGameId.set(String(game._id), String(existing[0]?.id || 'legacy-prequel'))
        return
      }
      if (!hasLegacyPrequel(game.prequel)) return
      const legacy = {
        ...game.prequel,
        id: String(game.prequel?.id || 'legacy-prequel'),
        title: String(game.prequel?.title || 'Приквел 1'),
        mainCodes: [],
        requiredMainCodesCount: null,
        completionBonus: { value: 0, description: '', storyEffects: [] },
      }
      prequelIdByGameId.set(String(game._id), legacy.id)
      gameOperations.push({
        updateOne: {
          filter: { _id: game._id },
          update: { $set: { prequels: [legacy] } },
        },
      })
    })

    const gameTeams = await GamesTeams.find({
      prequelProgress: { $ne: null },
      $or: [
        { prequelProgresses: { $exists: false } },
        { prequelProgresses: { $size: 0 } },
      ],
    }).project({ gameId: 1, prequelProgress: 1 }).toArray()
    const gameTeamOperations = gameTeams.map((gameTeam) => {
      const prequelId = prequelIdByGameId.get(String(gameTeam.gameId)) || 'legacy-prequel'
      return {
        updateOne: {
          filter: { _id: gameTeam._id },
          update: {
            $set: {
              prequelProgresses: [
                migrateProgress(gameTeam.prequelProgress, prequelId),
              ],
            },
          },
        },
      }
    })

    console.log({
      mode: isApply ? 'apply' : 'dry-run',
      gamesToMigrate: gameOperations.length,
      gameTeamsToMigrate: gameTeamOperations.length,
    })
    if (!isApply) {
      console.log('Для применения запустите скрипт с --apply')
      return
    }
    if (gameOperations.length > 0) await Games.bulkWrite(gameOperations)
    if (gameTeamOperations.length > 0) await GamesTeams.bulkWrite(gameTeamOperations)
    console.log('Миграция нескольких приквелов завершена')
  } finally {
    await connection.close()
  }
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
