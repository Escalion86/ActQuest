import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import dbConnectGlobal from '@utils/dbConnectGlobal'
import fetchGameHistoryState from '@server/gameHistory/fetchGameHistoryState'
import recordGameHistoryEntry from '@server/gameHistory/recordGameHistoryEntry'
import buildGameHistorySnapshot from '@server/gameHistory/buildGameHistorySnapshot'
import {
  normalizeGameOrganizerId,
  resolveGameOrganizerForCreate,
} from '@helpers/gameOrganizer'

const normalizeRole = (value) => {
  if (typeof value !== 'string') {
    return 'client'
  }
  const normalizedRaw = value.trim().toLowerCase()
  const normalized = normalizedRaw
  return ['client', 'admin', 'dev', 'ban'].includes(normalized)
    ? normalized
    : 'client'
}

const canCreateGames = (role) => {
  const normalizedRole = normalizeRole(role)
  return normalizedRole === 'admin' || normalizedRole === 'dev'
}

const normalizeStringOrNull = (value) => {
  if (typeof value !== 'string') {
    return null
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const normalizeTelegramId = (value) => {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null
  }

  return numeric
}

const normalizeIdOrNull = (value) => {
  if (typeof value === 'string') {
    return normalizeStringOrNull(value)
  }

  if (value !== null && value !== undefined && typeof value.toString === 'function') {
    return normalizeStringOrNull(value.toString())
  }

  return null
}

const resolveSessionUserId = (sessionUser) =>
  normalizeIdOrNull(
    sessionUser?.globalUserId ??
      sessionUser?.userId ??
      sessionUser?._id ??
      sessionUser?.id ??
      null,
  )

const normalizeShowTasksAudience = (value) =>
  value === 'participants' ? 'participants' : 'all'

export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: 'Необходима авторизация' },
      { status: 401 },
    )
  }

  if (!canCreateGames(session.user.role)) {
    return NextResponse.json(
      { success: false, error: 'Недостаточно прав для создания игры' },
      { status: 403 },
    )
  }

  const rawBody = await request.json().catch(() => ({}))
  const payload =
    rawBody && typeof rawBody === 'object' && rawBody.data && typeof rawBody.data === 'object'
      ? rawBody.data
      : rawBody

  const name = normalizeStringOrNull(payload?.name)
  const location = normalizeStringOrNull(payload?.location)
  if (!name) {
    return NextResponse.json(
      { success: false, error: 'Не указано название игры' },
      { status: 400 },
    )
  }
  if (!location) {
    return NextResponse.json(
      { success: false, error: 'Не указана площадка игры' },
      { status: 400 },
    )
  }

  const sessionCreatorUserId = resolveSessionUserId(session.user)
  const sessionCreatorTelegramId = normalizeTelegramId(session.user.telegramId)

  try {
    const db = await dbConnectGlobal()
    if (!db) {
      throw new Error('Соединение с базой данных не установлено')
    }

    const GamesModel = db.model('Games')
    const requestedCreatorUserId = normalizeGameOrganizerId(
      payload?.creatorUserId,
    )
    const requestedCreatorDoc = requestedCreatorUserId
      ? await db
          .model('Users')
          .findById(requestedCreatorUserId)
          .select({ _id: 1, role: 1, telegramId: 1 })
          .lean()
      : null
    const { creatorUserId, creatorTelegramId } = resolveGameOrganizerForCreate({
      requestedCreatorUserId,
      requestedCreatorDoc,
      sessionCreatorUserId,
      sessionCreatorTelegramId,
    })
    const createData = {
      ...payload,
      name,
      location: location.toLowerCase(),
      // При создании игра всегда скрыта.
      hidden: true,
      showTasksAudience: normalizeShowTasksAudience(payload?.showTasksAudience),
      creatorUserId,
      creatorTelegramId,
    }

    const createdGame = await GamesModel.create(createData)
    const createdJson = createdGame?.toObject ? createdGame.toObject() : createdGame
    const historyState = await fetchGameHistoryState({
      db,
      gameId: createdGame?._id,
      game: createdJson,
    })

    await recordGameHistoryEntry({
      db,
      gameId: createdGame?._id,
      location: createdJson?.location ?? location.toLowerCase(),
      actionType: 'game_created',
      entityScope: 'game',
      actor: {
        userId: sessionCreatorUserId,
        telegramId:
          sessionCreatorTelegramId !== null
            ? String(sessionCreatorTelegramId)
            : null,
        role: typeof session?.user?.role === 'string' ? session.user.role : '',
        name: typeof session?.user?.name === 'string' ? session.user.name : '',
      },
      beforeState: null,
      afterState: historyState,
      snapshot: buildGameHistorySnapshot(historyState),
      context: {
        summary: 'Игра создана',
      },
    })

    return NextResponse.json(
      { success: true, data: createdJson },
      { status: 201 },
    )
  } catch (error) {
    console.error('Failed to create game via cabinet API (app)', error)
    if (
      error?.message === 'Организатор игры не найден' ||
      error?.message ===
        'Организатором игры может быть только администратор или разработчик'
    ) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 },
      )
    }

    return NextResponse.json(
      { success: false, error: 'Не удалось создать игру' },
      { status: 500 },
    )
  }
}
