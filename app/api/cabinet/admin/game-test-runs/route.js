import mongoose from 'mongoose'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import dbConnectGlobal from '@utils/dbConnectGlobal'
import { canAccessGameAsModerator } from '@helpers/gameAssignmentAccess'
import { toStringId } from '@helpers/idAndDate'
import {
  buildTestGameSnapshot,
  isTestRunOwner,
  normalizeTestIdentity,
  normalizeTestRunId,
} from '@server/gameTestRuns'

const TEST_RUN_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000

const getSessionIdentity = (session) =>
  normalizeTestIdentity({
    userId:
      session?.user?.globalUserId ??
      session?.user?.userId ??
      session?.user?._id ??
      session?.user?.id,
    telegramId: session?.user?.telegramId,
  })

const canManageGame = ({ session, game, identity }) => {
  const role = String(session?.user?.role || '').trim().toLowerCase()
  if (role === 'admin' || role === 'dev') return true

  const creatorUserId = toStringId(game?.creatorUserId)
  if (identity.userId && creatorUserId === identity.userId) return true

  const creatorTelegramId = String(game?.creatorTelegramId || '').trim()
  if (
    identity.telegramId &&
    creatorTelegramId &&
    creatorTelegramId === identity.telegramId
  ) {
    return true
  }

  return canAccessGameAsModerator({
    userRole: role,
    currentUserId: identity.userId,
    game,
  })
}

const buildRunResponse = (run, options = {}) => ({
  id: toStringId(run?._id),
  gameId: toStringId(run?.gameId),
  testerRole: run?.testerRole || 'captain',
  createdAt: run?.createdAt || null,
  expiresAt: run?.expiresAt || null,
  resumed: Boolean(options.resumed),
  url: `/game/${encodeURIComponent(toStringId(run?.gameId))}/test/${encodeURIComponent(
    toStringId(run?._id),
  )}`,
})

export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: 'Необходима авторизация' },
      { status: 401 },
    )
  }

  const payload = (await request.json().catch(() => ({}))) || {}
  const gameId = toStringId(payload.gameId)
  const action = String(payload.action || 'start').trim().toLowerCase()
  if (!gameId || !['start', 'reset'].includes(action)) {
    return NextResponse.json(
      { success: false, error: 'Некорректные параметры тестового прогона' },
      { status: 400 },
    )
  }

  try {
    const db = await dbConnectGlobal()
    if (!db) throw new Error('Не удалось подключиться к базе данных')

    const Games = db.model('Games')
    const GameTestRuns = db.model('GameTestRuns')
    const game = await Games.findById(gameId).lean()
    if (!game?._id) {
      return NextResponse.json(
        { success: false, error: 'Игра не найдена' },
        { status: 404 },
      )
    }

    const identity = getSessionIdentity(session)
    if (!identity.userId && !identity.telegramId) {
      return NextResponse.json(
        { success: false, error: 'Не удалось определить пользователя' },
        { status: 403 },
      )
    }
    if (!canManageGame({ session, game, identity })) {
      return NextResponse.json(
        { success: false, error: 'Нет доступа к тестированию этой игры' },
        { status: 403 },
      )
    }

    const ownerFilter = identity.userId
      ? { ownerUserId: identity.userId }
      : { ownerTelegramId: identity.telegramId }
    const existing = await GameTestRuns.findOne({
      gameId,
      ...ownerFilter,
      expiresAt: { $gt: new Date() },
    })
      .sort({ updatedAt: -1 })
      .lean()

    if (existing && action === 'start') {
      return NextResponse.json({
        success: true,
        data: buildRunResponse(existing, { resumed: true }),
      })
    }

    await GameTestRuns.deleteMany({ gameId, ...ownerFilter })

    const now = new Date()
    const runId = new mongoose.Types.ObjectId()
    const run = await GameTestRuns.create({
      _id: runId,
      gameId,
      teamId: String(runId),
      ownerUserId: identity.userId || null,
      ownerTelegramId: identity.telegramId || null,
      testerRole: 'captain',
      gameSnapshot: buildTestGameSnapshot(game, now),
      expiresAt: new Date(now.getTime() + TEST_RUN_LIFETIME_MS),
      outOfCompetition: true,
      paidGame: true,
    })

    return NextResponse.json(
      { success: true, data: buildRunResponse(run) },
      { status: 201 },
    )
  } catch (error) {
    console.error('Failed to create game test run', error)
    return NextResponse.json(
      { success: false, error: 'Не удалось запустить тестовый прогон' },
      { status: 500 },
    )
  }
}

export async function DELETE(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: 'Необходима авторизация' },
      { status: 401 },
    )
  }

  const requestUrl = new URL(request.url)
  const runId = normalizeTestRunId(requestUrl.searchParams.get('runId'))
  if (!runId) {
    return NextResponse.json(
      { success: false, error: 'Не указан тестовый прогон' },
      { status: 400 },
    )
  }

  try {
    const db = await dbConnectGlobal()
    if (!db) throw new Error('Не удалось подключиться к базе данных')
    const GameTestRuns = db.model('GameTestRuns')
    const run = await GameTestRuns.findById(runId).lean()
    const identity = getSessionIdentity(session)
    if (!run?._id || !isTestRunOwner({ run, ...identity })) {
      return NextResponse.json(
        { success: false, error: 'Тестовый прогон не найден' },
        { status: 404 },
      )
    }

    await GameTestRuns.deleteOne({ _id: runId })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete game test run', error)
    return NextResponse.json(
      { success: false, error: 'Не удалось удалить тестовый прогон' },
      { status: 500 },
    )
  }
}
