import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import fetchGamesForCabinet from '@helpers/fetchGamesForCabinet'
import dbConnectGlobal from '@utils/dbConnectGlobal'

const isSessionDebugEnabled = process.env.SESSION_DEBUG === '1'
const sessionDebugLog = (stage, payload = null) => {
  if (!isSessionDebugEnabled) {
    return
  }

  const time = new Date().toISOString()
  if (payload === null || payload === undefined) {
    console.info(`[session-debug] ${time} ${stage}`)
    return
  }

  console.info(`[session-debug] ${time} ${stage}`, payload)
}

const parsePositiveInteger = (value, fallback) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric < 0) {
    return fallback
  }
  return Math.floor(numeric)
}

const resolveGamesView = (value) => {
  if (value === 'upcoming' || value === 'past') {
    return value
  }
  return 'all'
}

const normalizeRole = (value) => {
  if (typeof value !== 'string') {
    return null
  }

  const normalizedRaw = value.trim().toLowerCase()
  const normalized = normalizedRaw
  return ['client', 'moder', 'admin', 'dev'].includes(normalized)
    ? normalized
    : null
}

export async function GET(request) {
  const session = await getServerSession(authOptions)
  const requestUrl = new URL(request.url)
  if (!session?.user) {
    sessionDebugLog('games-list-pilot:unauthorized', {
      url: requestUrl.pathname + requestUrl.search,
      hasCookieHeader: Boolean(request?.headers?.get?.('cookie')),
      userAgent: request?.headers?.get?.('user-agent') ?? null,
    })
    return NextResponse.json(
      { success: false, error: 'Требуется авторизация' },
      { status: 401 },
    )
  }

  sessionDebugLog('games-list-pilot:authorized', {
    url: requestUrl.pathname + requestUrl.search,
    userId: session?.user?._id ?? session?.user?.globalUserId ?? null,
    role: session?.user?.role ?? null,
    location: session?.user?.location ?? null,
  })

  const query = requestUrl.searchParams
  const sessionRole = normalizeRole(session?.user?.role) ?? 'client'
  const previewRole = normalizeRole(query.get('rolePreview'))
  const userRole =
    sessionRole === 'dev' && previewRole && previewRole !== 'dev'
      ? previewRole
      : sessionRole

  const rawTelegramId = session?.user?.telegramId
  const creatorTelegramId =
    rawTelegramId === null || rawTelegramId === undefined
      ? null
      : Number(rawTelegramId)
  const currentUserId =
    session?.user?._id === null || session?.user?._id === undefined
      ? null
      : String(session.user._id)
  const currentUserTelegramId = Number.isFinite(creatorTelegramId)
    ? creatorTelegramId
    : null

  const hasLocationQueryParam = query.has('location')
  const locationFromQuery = hasLocationQueryParam ? query.get('location') : null
  const locationFromSession =
    typeof session?.user?.location === 'string' ? session.user.location : null
  const locationBase = hasLocationQueryParam ? locationFromQuery : locationFromSession
  const location = (locationBase || '').trim().toLowerCase()
  const normalizedLocation = location === 'all' ? null : location || null

  const offset = parsePositiveInteger(query.get('offset'), 0)
  const limit = parsePositiveInteger(query.get('limit'), 10)
  const view = resolveGamesView(query.get('view'))

  try {
    const db = await dbConnectGlobal()
    if (!db) {
      throw new Error('Не удалось подключиться к базе данных')
    }

    const { games, hasMore } = await fetchGamesForCabinet({
      db,
      location: normalizedLocation,
      userRole,
      creatorTelegramId: Number.isFinite(creatorTelegramId)
        ? creatorTelegramId
        : null,
      currentUserId,
      currentUserTelegramId,
      offset,
      limit,
      view,
    })

    return NextResponse.json(
      {
        success: true,
        data: games,
        meta: {
          offset,
          limit,
          hasMore,
        },
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('Failed to load games list (app)', error)
    return NextResponse.json(
      { success: false, error: 'Не удалось загрузить список игр' },
      { status: 500 },
    )
  }
}

