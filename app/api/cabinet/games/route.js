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
  return normalizedRole === 'admin' || normalizedRole === 'dev' || normalizedRole === 'moder'
}

const normalizeStringOrNull = (value) => {
  if (typeof value !== 'string') {
    return null
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

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

  const creatorTelegramIdRaw = Number(session.user.telegramId)
  const creatorTelegramId = Number.isFinite(creatorTelegramIdRaw)
    ? creatorTelegramIdRaw
    : null

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
      creatorTelegramId:
        Number.isFinite(Number(payload?.creatorTelegramId))
          ? Number(payload.creatorTelegramId)
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
