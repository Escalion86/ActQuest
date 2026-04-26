import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import dbConnectGlobal from '@utils/dbConnectGlobal'

const normalizeRole = (value) => {
  if (typeof value !== 'string') {
    return 'client'
  }
  const normalizedRaw = value.trim().toLowerCase()
  const normalized = normalizedRaw
  return ['client', 'moder', 'admin', 'dev'].includes(normalized)
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

  const creatorUserId = resolveSessionUserId(session.user)
  const creatorTelegramId = normalizeTelegramId(session.user.telegramId)

  try {
    const db = await dbConnectGlobal()
    if (!db) {
      throw new Error('Соединение с базой данных не установлено')
    }

    const GamesModel = db.model('Games')
    const createData = {
      ...payload,
      name,
      location: location.toLowerCase(),
      // При создании игра всегда скрыта.
      hidden: true,
      creatorUserId,
      creatorTelegramId:
        normalizeTelegramId(payload?.creatorTelegramId) !== null
          ? normalizeTelegramId(payload?.creatorTelegramId)
          : creatorTelegramId,
    }

    const createdGame = await GamesModel.create(createData)
    const createdJson = createdGame?.toObject ? createdGame.toObject() : createdGame

    return NextResponse.json(
      { success: true, data: createdJson },
      { status: 201 },
    )
  } catch (error) {
    console.error('Failed to create game via cabinet API (app)', error)
    return NextResponse.json(
      { success: false, error: 'Не удалось создать игру' },
      { status: 500 },
    )
  }
}
