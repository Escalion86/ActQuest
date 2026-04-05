import dbConnectGlobal from '@utils/dbConnectGlobal'
import fetchGamesForCabinet from '@helpers/fetchGamesForCabinet'

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

const normalizeLocation = (value) => {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim().toLowerCase()
  return normalized || null
}

export const loadCabinetAppGames = async ({ session, view }) => {
  const db = await dbConnectGlobal()
  if (!db) {
    return []
  }

  const role = normalizeRole(session?.user?.role)
  const location = normalizeLocation(session?.user?.location)
  const rawTelegramId = session?.user?.telegramId
  const creatorTelegramId =
    rawTelegramId === null || rawTelegramId === undefined
      ? null
      : Number(rawTelegramId)
  const currentUserId =
    session?.user?._id === null || session?.user?._id === undefined
      ? null
      : String(session.user._id)

  const { games } = await fetchGamesForCabinet({
    db,
    location,
    userRole: role,
    creatorTelegramId: Number.isFinite(creatorTelegramId)
      ? creatorTelegramId
      : null,
    currentUserId,
    currentUserTelegramId: Number.isFinite(creatorTelegramId)
      ? creatorTelegramId
      : null,
    offset: 0,
    limit: 10,
    view: view === 'past' ? 'past' : 'upcoming',
  })

  return Array.isArray(games) ? games : []
}

