import { getServerSession } from 'next-auth/next'

import { authOptions } from '@pages/api/auth/[...nextauth]'
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
  const normalized = normalizedRaw === 'moderator' ? 'moder' : normalizedRaw
  return ['client', 'moder', 'admin', 'dev'].includes(normalized)
    ? normalized
    : null
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).json({ success: false, error: 'Метод не поддерживается' })
  }

  const session = await getServerSession(req, res, authOptions)
  if (!session?.user) {
    sessionDebugLog('games-list:unauthorized', {
      url: req?.url ?? null,
      hasCookieHeader: Boolean(req?.headers?.cookie),
      cookieLength:
        typeof req?.headers?.cookie === 'string'
          ? req.headers.cookie.length
          : 0,
      userAgent: req?.headers?.['user-agent'] ?? null,
    })
    return res.status(401).json({ success: false, error: 'Требуется авторизация' })
  }

  sessionDebugLog('games-list:authorized', {
    url: req?.url ?? null,
    userId: session?.user?._id ?? session?.user?.globalUserId ?? null,
    role: session?.user?.role ?? null,
    location: session?.user?.location ?? null,
  })

  const sessionRole = normalizeRole(session?.user?.role) ?? 'client'
  const previewRole = normalizeRole(req.query?.rolePreview)
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
  const currentUserTelegramId = Number.isFinite(creatorTelegramId) ? creatorTelegramId : null

  const hasLocationQueryParam = Object.prototype.hasOwnProperty.call(req.query || {}, 'location')
  const locationFromQuery =
    hasLocationQueryParam && typeof req.query?.location === 'string'
      ? req.query.location
      : null
  const locationFromSession =
    typeof session?.user?.location === 'string' ? session.user.location : null
  const locationBase = hasLocationQueryParam ? locationFromQuery : locationFromSession
  const location = (locationBase || '').trim().toLowerCase()
  const normalizedLocation = location === 'all' ? null : location || null

  const offset = parsePositiveInteger(req.query?.offset, 0)
  const limit = parsePositiveInteger(req.query?.limit, 10)
  const view = resolveGamesView(req.query?.view)

  try {
    const db = await dbConnectGlobal()
    if (!db) {
      throw new Error('Не удалось подключиться к базе данных')
    }

    const { games, hasMore } = await fetchGamesForCabinet({
      db,
      location: normalizedLocation,
      userRole,
      creatorTelegramId: Number.isFinite(creatorTelegramId) ? creatorTelegramId : null,
      currentUserId,
      currentUserTelegramId,
      offset,
      limit,
      view,
    })

    return res.status(200).json({
      success: true,
      data: games,
      meta: {
        offset,
        limit,
        hasMore,
      },
    })
  } catch (error) {
    console.error('Failed to load games list', error)
    return res.status(500).json({ success: false, error: 'Не удалось загрузить список игр' })
  }
}
