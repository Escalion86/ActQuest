import fs from 'node:fs'
import path from 'node:path'
import mongoose from 'mongoose'

import {
  buildCompletedParticipationStats,
  buildParticipationSnapshot,
} from '../server/buildCompletedParticipationStats.js'
import { COMPLETED_PARTICIPATION_STATUSES } from '../helpers/gameParticipation.js'

const BATCH_SIZE = 500

const loadEnvFile = (fileName) => {
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
      ) {
        value = value.slice(1, -1)
      }
      if (typeof process.env[key] === 'undefined') {
        process.env[key] = value
      }
    })
}

loadEnvFile('.env.local')
loadEnvFile('.env')

const args = process.argv.slice(2)
const isApply = args.includes('--apply')
const allowUnresolved = args.includes('--allow-unresolved')
const confirmedDbName =
  args
    .find((arg) => arg.startsWith('--confirm-db='))
    ?.slice('--confirm-db='.length)
    .trim() || ''

const normalizeIso = (value) => {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

const comparableSnapshot = (snapshot) => ({
  version: Number(snapshot?.version) || 1,
  playedGamesCount: Number(snapshot?.playedGamesCount) || 0,
  winsCount: Number(snapshot?.winsCount) || 0,
  podiumCount: Number(snapshot?.podiumCount) || 0,
  lastPlayedAt: normalizeIso(snapshot?.lastPlayedAt),
})

const snapshotsEqual = (first, second) =>
  JSON.stringify(comparableSnapshot(first)) ===
  JSON.stringify(comparableSnapshot(second))

const mergeGamesById = (target, source) => {
  if (!(source instanceof Map)) return
  source.forEach((item, gameId) => {
    const previous = target.get(gameId)
    if (!previous || item.place < previous.place) {
      target.set(gameId, item)
    }
  })
}

const runBulkWrite = async (collection, operations) => {
  let modifiedCount = 0
  for (let index = 0; index < operations.length; index += BATCH_SIZE) {
    const batch = operations.slice(index, index + BATCH_SIZE)
    const result = await collection.bulkWrite(batch, { ordered: false })
    modifiedCount += Number(result.modifiedCount) || 0
  }
  return modifiedCount
}

const run = async () => {
  const mongoUri = process.env.MONGODB_URI
  const dbName = process.env.MONGODB_GLOBAL_DBNAME
  if (!mongoUri || !dbName) {
    throw new Error('Не заданы MONGODB_URI или MONGODB_GLOBAL_DBNAME')
  }
  if (isApply && confirmedDbName !== dbName) {
    throw new Error(
      `Для записи подтвердите базу: --confirm-db=${dbName}`,
    )
  }

  const connection = await mongoose
    .createConnection(mongoUri, { dbName })
    .asPromise()

  try {
    const Games = connection.collection('games')
    const Users = connection.collection('users')
    const Teams = connection.collection('teams')
    const [games, users, teams] = await Promise.all([
      Games.find({ status: { $in: COMPLETED_PARTICIPATION_STATUSES } })
        .project({
          status: 1,
          dateStart: 1,
          dateStartFact: 1,
          updatedAt: 1,
          result: 1,
        })
        .toArray(),
      Users.find({})
        .project({ telegramId: 1, gameStats: 1 })
        .toArray(),
      Teams.find({})
        .project({ gameStats: 1 })
        .toArray(),
    ])

    const { userGamesByKey, teamGamesById, diagnostics } =
      buildCompletedParticipationStats(games)
    const usersById = new Map(users.map((user) => [String(user._id), user]))
    const usersByTelegramId = new Map()
    users.forEach((user) => {
      const telegramId = Number(user?.telegramId)
      if (!Number.isFinite(telegramId) || telegramId <= 0) return
      const key = String(telegramId)
      if (!usersByTelegramId.has(key)) usersByTelegramId.set(key, [])
      usersByTelegramId.get(key).push(user)
    })

    const userGamesByDocumentId = new Map(
      users.map((user) => [String(user._id), new Map()]),
    )
    const unresolvedUserRefs = []
    const duplicateTelegramRefs = []
    userGamesByKey.forEach((gamesById, participantKey) => {
      let matchedUsers = []
      if (participantKey.startsWith('uid:')) {
        const user = usersById.get(participantKey.slice(4))
        if (user) matchedUsers = [user]
      } else if (participantKey.startsWith('tg:')) {
        matchedUsers = usersByTelegramId.get(participantKey.slice(3)) || []
        if (matchedUsers.length > 1) {
          duplicateTelegramRefs.push({
            participantKey,
            userIds: matchedUsers.map((user) => String(user._id)),
          })
        }
      }

      if (matchedUsers.length === 0) {
        unresolvedUserRefs.push(participantKey)
        return
      }
      matchedUsers.forEach((user) => {
        mergeGamesById(
          userGamesByDocumentId.get(String(user._id)),
          gamesById,
        )
      })
    })

    const nowIso = new Date().toISOString()
    const userOperations = []
    const teamOperations = []
    const sampleChanges = { users: [], teams: [] }
    let usersUnchanged = 0
    let teamsUnchanged = 0
    let usersResetToZero = 0
    let teamsResetToZero = 0

    users.forEach((user) => {
      const gamesById = userGamesByDocumentId.get(String(user._id))
      const expected = buildParticipationSnapshot({ gamesById, nowIso })
      if (snapshotsEqual(user.gameStats, expected)) {
        usersUnchanged += 1
        return
      }
      if (expected.playedGamesCount === 0) usersResetToZero += 1
      if (sampleChanges.users.length < 20) {
        sampleChanges.users.push({
          id: String(user._id),
          before: comparableSnapshot(user.gameStats),
          after: comparableSnapshot(expected),
        })
      }
      userOperations.push({
        updateOne: {
          filter: { _id: user._id },
          update: { $set: { gameStats: expected } },
        },
      })
    })

    const teamsById = new Map(teams.map((team) => [String(team._id), team]))
    const unresolvedTeamRefs = Array.from(teamGamesById.keys()).filter(
      (teamId) => !teamsById.has(teamId),
    )
    teams.forEach((team) => {
      const gamesById = teamGamesById.get(String(team._id))
      const expected = buildParticipationSnapshot({ gamesById, nowIso })
      if (snapshotsEqual(team.gameStats, expected)) {
        teamsUnchanged += 1
        return
      }
      if (expected.playedGamesCount === 0) teamsResetToZero += 1
      if (sampleChanges.teams.length < 20) {
        sampleChanges.teams.push({
          id: String(team._id),
          before: comparableSnapshot(team.gameStats),
          after: comparableSnapshot(expected),
        })
      }
      teamOperations.push({
        updateOne: {
          filter: { _id: team._id },
          update: { $set: { gameStats: expected } },
        },
      })
    })

    const report = {
      mode: isApply ? 'apply' : 'dry-run',
      generatedAt: nowIso,
      dbName,
      games: {
        completedScanned: games.length,
        ...diagnostics,
      },
      users: {
        total: users.length,
        toUpdate: userOperations.length,
        unchanged: usersUnchanged,
        resetToZero: usersResetToZero,
        unresolvedSnapshotRefs: unresolvedUserRefs.length,
        duplicateTelegramRefs: duplicateTelegramRefs.length,
      },
      teams: {
        total: teams.length,
        toUpdate: teamOperations.length,
        unchanged: teamsUnchanged,
        resetToZero: teamsResetToZero,
        unresolvedSnapshotRefs: unresolvedTeamRefs.length,
      },
      unresolved: {
        users: unresolvedUserRefs.slice(0, 100),
        duplicateTelegrams: duplicateTelegramRefs.slice(0, 100),
        teams: unresolvedTeamRefs.slice(0, 100),
      },
      sampleChanges,
    }

    if (!isApply) {
      console.log(JSON.stringify(report, null, 2))
      console.log(
        `Для применения: npm run backfill:participation-stats -- --apply --confirm-db=${dbName}`,
      )
      return
    }

    if (
      !allowUnresolved &&
      (unresolvedUserRefs.length > 0 || duplicateTelegramRefs.length > 0)
    ) {
      console.log(JSON.stringify(report, null, 2))
      throw new Error(
        'Запись остановлена: есть unresolved пользователи или дубли Telegram. Исправьте ссылки либо явно добавьте --allow-unresolved.',
      )
    }

    const [usersModified, teamsModified] = await Promise.all([
      runBulkWrite(Users, userOperations),
      runBulkWrite(Teams, teamOperations),
    ])
    report.users.modified = usersModified
    report.teams.modified = teamsModified
    console.log(JSON.stringify(report, null, 2))
  } finally {
    await connection.close()
  }
}

run().catch((error) => {
  console.error('[backfill:participation-stats] Ошибка')
  console.error(error)
  process.exitCode = 1
})
