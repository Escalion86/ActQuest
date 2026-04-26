import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import dbConnectGlobal from '@utils/dbConnectGlobal'

const SAMPLE_LIMIT = 50

const isDeveloperRole = (role) => {
  if (typeof role !== 'string') {
    return false
  }

  return role.trim().toLowerCase() === 'dev'
}

const normalizeTelegramId = (value) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null
  }

  return Math.trunc(numeric)
}

const normalizeString = (value) =>
  typeof value === 'string' ? value.trim() : ''

const normalizeGameSample = ({ game, user = null, issue = null }) => ({
  gameId: String(game?._id || ''),
  title: normalizeString(game?.title) || normalizeString(game?.name),
  location: normalizeString(game?.location) || null,
  status: normalizeString(game?.status) || null,
  creatorTelegramId: normalizeTelegramId(game?.creatorTelegramId),
  creatorUserId: normalizeString(game?.creatorUserId) || null,
  matchedUser: user
    ? {
        id: String(user?._id || ''),
        name: normalizeString(user?.name),
        username: normalizeString(user?.username),
        telegramId: normalizeTelegramId(user?.telegramId),
      }
    : null,
  issue,
})

const buildBackfillPlan = async ({ gamesModel, usersModel }) => {
  const gamesMissingCreatorUserId = await gamesModel
    .find({
      $and: [
        {
          $or: [
            { creatorUserId: null },
            { creatorUserId: { $exists: false } },
            { creatorUserId: '' },
          ],
        },
        {
          creatorTelegramId: { $exists: true, $nin: [null, 0, ''] },
        },
      ],
    })
    .select({
      _id: 1,
      title: 1,
      name: 1,
      location: 1,
      status: 1,
      creatorUserId: 1,
      creatorTelegramId: 1,
    })
    .sort({ createdAt: -1, _id: 1 })
    .lean()

  const telegramIds = [
    ...new Set(
      gamesMissingCreatorUserId
        .map((game) => normalizeTelegramId(game?.creatorTelegramId))
        .filter(Boolean),
    ),
  ]

  const users = telegramIds.length
    ? await usersModel
        .find({ telegramId: { $in: telegramIds } })
        .select({ _id: 1, name: 1, username: 1, telegramId: 1 })
        .lean()
    : []

  const usersByTelegramId = new Map()
  users.forEach((user) => {
    const telegramId = normalizeTelegramId(user?.telegramId)
    if (!telegramId) {
      return
    }

    const existing = usersByTelegramId.get(telegramId) || []
    existing.push(user)
    usersByTelegramId.set(telegramId, existing)
  })

  const updates = []
  const unmatchedGames = []
  const ambiguousGames = []

  gamesMissingCreatorUserId.forEach((game) => {
    const telegramId = normalizeTelegramId(game?.creatorTelegramId)
    const matchedUsers = telegramId ? usersByTelegramId.get(telegramId) || [] : []

    if (matchedUsers.length === 1) {
      updates.push({
        game,
        user: matchedUsers[0],
        update: {
          $set: {
            creatorUserId: String(matchedUsers[0]._id),
          },
        },
      })
      return
    }

    if (matchedUsers.length > 1) {
      ambiguousGames.push({
        game,
        users: matchedUsers,
      })
      return
    }

    unmatchedGames.push(game)
  })

  return {
    gamesMissingCreatorUserId,
    updates,
    unmatchedGames,
    ambiguousGames,
  }
}

const runBackfill = async ({ dryRun }) => {
  const db = await dbConnectGlobal()
  if (!db) {
    throw new Error('Не удалось подключиться к базе данных')
  }

  const gamesModel = db.model('Games')
  const usersModel = db.model('Users')
  const totalGamesCount = await gamesModel.countDocuments({})
  const { gamesMissingCreatorUserId, updates, unmatchedGames, ambiguousGames } =
    await buildBackfillPlan({ gamesModel, usersModel })

  let updatedCount = 0

  if (!dryRun && updates.length > 0) {
    const writeResult = await gamesModel.bulkWrite(
      updates.map((item) => ({
        updateOne: {
          filter: {
            _id: item.game._id,
            $or: [
              { creatorUserId: null },
              { creatorUserId: { $exists: false } },
              { creatorUserId: '' },
            ],
          },
          update: item.update,
        },
      })),
      { ordered: false },
    )

    updatedCount =
      Number(writeResult?.modifiedCount) || Number(writeResult?.nModified) || 0
  }

  return {
    dryRun,
    totalGamesCount,
    missingCreatorUserIdCount: gamesMissingCreatorUserId.length,
    matchedCount: updates.length,
    unmatchedCount: unmatchedGames.length,
    ambiguousCount: ambiguousGames.length,
    updatedCount,
    matchedSamples: updates
      .slice(0, SAMPLE_LIMIT)
      .map(({ game, user }) => normalizeGameSample({ game, user })),
    unmatchedSamples: unmatchedGames
      .slice(0, SAMPLE_LIMIT)
      .map((game) =>
        normalizeGameSample({ game, issue: 'user_not_found_by_telegram_id' }),
      ),
    ambiguousSamples: ambiguousGames.slice(0, SAMPLE_LIMIT).map((item) => ({
      ...normalizeGameSample({
        game: item.game,
        issue: 'multiple_users_with_same_telegram_id',
      }),
      matchedUsers: item.users.map((user) => ({
        id: String(user?._id || ''),
        name: normalizeString(user?.name),
        username: normalizeString(user?.username),
        telegramId: normalizeTelegramId(user?.telegramId),
      })),
    })),
  }
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user || !isDeveloperRole(session.user.role)) {
    return NextResponse.json(
      { success: false, error: 'Недостаточно прав' },
      { status: 403 },
    )
  }

  try {
    const data = await runBackfill({ dryRun: true })
    return NextResponse.json({ success: true, data }, { status: 200 })
  } catch (error) {
    console.error('Failed to preview game creators backfill (app)', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Не удалось проверить creatorUserId игр',
      },
      { status: 500 },
    )
  }
}

export async function POST(req) {
  const session = await getServerSession(authOptions)
  if (!session?.user || !isDeveloperRole(session.user.role)) {
    return NextResponse.json(
      { success: false, error: 'Недостаточно прав' },
      { status: 403 },
    )
  }

  try {
    const body = await req.json().catch(() => ({}))
    const dryRun = body?.dryRun !== false
    const confirmApply = body?.confirmApply === true

    if (!dryRun && !confirmApply) {
      return NextResponse.json(
        {
          success: false,
          error: 'Для применения backfill нужен confirmApply=true',
        },
        { status: 400 },
      )
    }

    const data = await runBackfill({ dryRun })
    return NextResponse.json({ success: true, data }, { status: 200 })
  } catch (error) {
    console.error('Failed to backfill game creators (app)', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Не удалось заполнить creatorUserId игр',
      },
      { status: 500 },
    )
  }
}
