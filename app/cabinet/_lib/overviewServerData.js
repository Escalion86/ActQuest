import dbConnectGlobal from '@utils/dbConnectGlobal'
import fetchGamesForCabinet from '@helpers/fetchGamesForCabinet'
import fetchTeamsForCabinet from '@helpers/fetchTeamsForCabinet'
import { LOCATIONS } from '@server/serverConstants'

const normalizeRole = (value) => {
  if (typeof value !== 'string') {
    return 'client'
  }

  const normalizedRaw = value.trim().toLowerCase()
  const normalized = normalizedRaw === 'moderator' ? 'moder' : normalizedRaw
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

const normalizeLocationName = (locationKey) => {
  const location = locationKey ? LOCATIONS[locationKey] : null
  const rawName = location?.townRu ?? ''

  if (!rawName) {
    return 'Город не выбран'
  }

  return rawName.charAt(0).toUpperCase() + rawName.slice(1)
}

const toFiniteNumberOrNull = (value) => {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

export const loadCabinetAppOverview = async (session) => {
  const location = normalizeLocation(session?.user?.location)
  const role = normalizeRole(session?.user?.role)
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

  const baseData = {
    cityName: normalizeLocationName(location),
    teamsCount: 0,
    completedGamesCount: 0,
    upcomingGamesCount: 0,
    pastGamesCount: 0,
    nearestGame: null,
  }

  const db = await dbConnectGlobal()
  if (!db || !location) {
    return baseData
  }

  const TeamsUsersModel = db.model('TeamsUsers')
  const membershipOr = []
  if (currentUserId) {
    membershipOr.push({ userId: currentUserId })
  }
  if (Number.isFinite(currentUserTelegramId)) {
    membershipOr.push({ userTelegramId: currentUserTelegramId })
  }

  const memberships =
    membershipOr.length > 0
      ? await TeamsUsersModel.find({ $or: membershipOr }).select({ teamId: 1 }).lean()
      : []

  const teamIds = Array.from(
    new Set(
      (Array.isArray(memberships) ? memberships : [])
        .map((membership) =>
          membership?.teamId ? String(membership.teamId) : null,
        )
        .filter(Boolean),
    ),
  )

  const teams = teamIds.length
    ? await fetchTeamsForCabinet({ db, teamIds, location, limit: 500, offset: 0 })
    : []

  const { games: upcomingGames } = await fetchGamesForCabinet({
    db,
    location,
    userRole: role,
    creatorTelegramId: Number.isFinite(creatorTelegramId)
      ? creatorTelegramId
      : null,
    currentUserId,
    currentUserTelegramId,
    offset: 0,
    limit: 500,
    view: 'upcoming',
  })

  const { games: pastGames } = await fetchGamesForCabinet({
    db,
    location,
    userRole: role,
    creatorTelegramId: Number.isFinite(creatorTelegramId)
      ? creatorTelegramId
      : null,
    currentUserId,
    currentUserTelegramId,
    offset: 0,
    limit: 500,
    view: 'past',
  })

  const nearestGame = Array.isArray(upcomingGames) ? upcomingGames[0] : null
  const completedGamesCount = (Array.isArray(pastGames) ? pastGames : []).filter(
    (game) => {
      const place = toFiniteNumberOrNull(game?.userTeamPlace)
      return place !== null && place > 0
    },
  ).length

  return {
    cityName: normalizeLocationName(location),
    teamsCount: Array.isArray(teams) ? teams.length : 0,
    completedGamesCount,
    upcomingGamesCount: Array.isArray(upcomingGames) ? upcomingGames.length : 0,
    pastGamesCount: Array.isArray(pastGames) ? pastGames.length : 0,
    nearestGame: nearestGame
      ? {
          id: nearestGame.id || null,
          name: nearestGame.name || 'Без названия',
          status: nearestGame.status || '',
          dateStart: nearestGame.dateStart || null,
        }
      : null,
  }
}

