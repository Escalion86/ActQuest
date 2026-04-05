import dbConnectGlobal from '@utils/dbConnectGlobal'
import fetchGamesForCabinet from '@helpers/fetchGamesForCabinet'
import fetchTeamsForCabinet from '@helpers/fetchTeamsForCabinet'
import normalizeSiteSettings from '@helpers/normalizeSiteSettings'
import resolveEntityRating from '@helpers/resolveEntityRating'
import resolveSessionUserFilter from '@helpers/resolveSessionUserFilter'
import { LOCATIONS } from '@server/serverConstants'

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

const toISOStringOrNull = (value) => {
  if (!value) {
    return null
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

const formatDateLabel = (value) => {
  if (!value) {
    return 'Дата не задана'
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return 'Дата не задана'
  }

  return parsed.toLocaleString('ru-RU')
}

const buildBaseData = (location) => ({
  cityName: normalizeLocationName(location),
  teamsCount: 0,
  participantTeams: [],
  completedGamesCount: 0,
  averageFinishedPlace: null,
  upcomingGamesCount: 0,
  pastGamesCount: 0,
  hasTeam: false,
  hasUpcomingRegistration: false,
  profileCompleted: false,
  nearestGame: null,
  personalProgressGames: [],
  rating: {
    isEligible: false,
    rank: null,
    totalRanked: 0,
    finalScore: null,
    playersAbove: null,
    playedGames: 0,
    missedGames: 0,
  },
  recentActivity: [],
  chatUrl: '',
  chatUrlsByLocation: {
    krsk: '',
    nrsk: '',
    ekb: '',
  },
})

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

  const baseData = buildBaseData(location)

  const db = await dbConnectGlobal()
  if (!db || !location) {
    return baseData
  }

  const userLookupFilter = resolveSessionUserFilter(session?.user)
  const userDoc = userLookupFilter
    ? await db
        .model('Users')
        .findOne(userLookupFilter)
        .select({
          _id: 1,
          telegramId: 1,
          name: 1,
          username: 1,
          rating: 1,
        })
        .lean()
    : null

  const normalizedUserId = userDoc?._id ? String(userDoc._id) : currentUserId
  const normalizedTelegramId = Number.isFinite(Number(userDoc?.telegramId))
    ? Number(userDoc.telegramId)
    : currentUserTelegramId

  const TeamsUsersModel = db.model('TeamsUsers')
  const membershipOr = []

  if (normalizedUserId) {
    membershipOr.push({ userId: normalizedUserId })
  }
  if (Number.isFinite(normalizedTelegramId)) {
    membershipOr.push({ userTelegramId: normalizedTelegramId })
  }

  const memberships =
    membershipOr.length > 0
      ? await TeamsUsersModel.find({ $or: membershipOr })
          .select({ _id: 1, teamId: 1, role: 1 })
          .lean()
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
    ? await fetchTeamsForCabinet({
        db,
        teamIds,
        location,
        limit: 500,
        offset: 0,
      })
    : []

  const membershipByTeamId = (Array.isArray(memberships) ? memberships : []).reduce(
    (acc, membership) => {
      const teamId = membership?.teamId ? String(membership.teamId) : null
      if (!teamId) {
        return acc
      }

      const roleValue = String(membership?.role ?? '')
        .trim()
        .toLowerCase()
      const isCaptain = roleValue === 'capitan'

      if (!acc[teamId]) {
        acc[teamId] = {
          membershipId: membership?._id ? String(membership._id) : null,
          isCaptain,
        }
        return acc
      }

      if (!acc[teamId].membershipId && membership?._id) {
        acc[teamId].membershipId = String(membership._id)
      }
      acc[teamId].isCaptain = acc[teamId].isCaptain || isCaptain
      return acc
    },
    {},
  )

  const participantTeams = (Array.isArray(teams) ? teams : []).map((team) => {
    const teamId = team?.id ? String(team.id) : null
    const membership = teamId ? membershipByTeamId[teamId] : null

    return {
      ...team,
      membershipId: membership?.membershipId ?? null,
      isCaptain: Boolean(membership?.isCaptain),
    }
  })

  const { games: upcomingGames } = await fetchGamesForCabinet({
    db,
    location,
    userRole: role,
    creatorTelegramId: Number.isFinite(creatorTelegramId)
      ? creatorTelegramId
      : null,
    currentUserId: normalizedUserId,
    currentUserTelegramId: normalizedTelegramId,
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
    currentUserId: normalizedUserId,
    currentUserTelegramId: normalizedTelegramId,
    offset: 0,
    limit: 500,
    view: 'past',
  })

  const nearestGame = Array.isArray(upcomingGames) ? upcomingGames[0] : null

  const personalProgressGames = (Array.isArray(pastGames) ? pastGames : [])
    .map((game) => {
      const place = toFiniteNumberOrNull(game?.userTeamPlace)
      if (place === null || place <= 0) {
        return null
      }

      const firstTeam = Array.isArray(game?.userParticipationTeams)
        ? game.userParticipationTeams[0]
        : null

      return {
        id: game?.id ? String(game.id) : null,
        gameName: typeof game?.name === 'string' ? game.name : 'Без названия',
        image: typeof game?.image === 'string' ? game.image : '',
        dateLabel: formatDateLabel(game?.dateStart),
        teamName:
          typeof firstTeam?.teamName === 'string' && firstTeam.teamName.trim()
            ? firstTeam.teamName.trim()
            : null,
        place,
        timestamp:
          toISOStringOrNull(game?.dateStart) ??
          toISOStringOrNull(game?.updatedAt) ??
          null,
      }
    })
    .filter(Boolean)
    .sort((a, b) => {
      const first = a?.timestamp ? new Date(a.timestamp).getTime() : 0
      const second = b?.timestamp ? new Date(b.timestamp).getTime() : 0
      return second - first
    })
    .slice(0, 30)

  const completedGamesCountFromProgress = personalProgressGames.length
  const averageFinishedPlace =
    completedGamesCountFromProgress > 0
      ? personalProgressGames.reduce((acc, game) => acc + Number(game.place || 0), 0) /
        completedGamesCountFromProgress
      : null

  const hasUpcomingRegistration = (Array.isArray(upcomingGames) ? upcomingGames : []).some(
    (game) =>
      Array.isArray(game?.userParticipationTeams) &&
      game.userParticipationTeams.length > 0,
  )

  const recentActivity = []
  if (participantTeams.length > 0) {
    recentActivity.push({
      id: `teams-${participantTeams.length}`,
      title: 'Команды',
      details:
        participantTeams.length > 1
          ? `Вы состоите в ${participantTeams.length} командах`
          : 'Вы состоите в 1 команде',
      timestamp: new Date().toISOString(),
    })
  }
  if (personalProgressGames[0]) {
    recentActivity.push({
      id: `played-${personalProgressGames[0].id}`,
      title: 'Последняя сыгранная игра',
      details: personalProgressGames[0].gameName,
      timestamp: personalProgressGames[0].timestamp ?? new Date().toISOString(),
    })
  }
  if (nearestGame) {
    recentActivity.push({
      id: `nearest-${nearestGame.id ?? 'unknown'}`,
      title: 'Ближайшая игра',
      details: nearestGame.name || 'Без названия',
      timestamp:
        toISOStringOrNull(nearestGame.dateStart) ?? new Date().toISOString(),
    })
  }

  const settingsDoc = await db
    .model('SiteSettings')
    .findOne({})
    .select({ chatUrl: 1, chatUrlsByLocation: 1 })
    .lean()

  const siteSettings = normalizeSiteSettings(settingsDoc)
  const chatUrlsByLocation =
    siteSettings?.chatUrlsByLocation && typeof siteSettings.chatUrlsByLocation === 'object'
      ? siteSettings.chatUrlsByLocation
      : { krsk: '', nrsk: '', ekb: '' }

  const rating = resolveEntityRating({
    entity: userDoc ?? session?.user ?? null,
    location,
  }) ?? {
    isEligible: false,
    rank: null,
    totalRanked: 0,
    finalScore: null,
    playersAbove: null,
    playedGames: 0,
    missedGames: 0,
  }

  const playedGamesFromRating = Number.isFinite(Number(rating?.playedGames))
    ? Number(rating.playedGames)
    : 0
  const completedGamesCount = Math.max(
    completedGamesCountFromProgress,
    playedGamesFromRating,
  )

  const profileCompleted = Boolean(
    String(userDoc?.name ?? session?.user?.name ?? '').trim() &&
      String(userDoc?.username ?? session?.user?.username ?? '').trim(),
  )

  return {
    cityName: normalizeLocationName(location),
    teamsCount: participantTeams.length,
    participantTeams,
    completedGamesCount,
    averageFinishedPlace,
    upcomingGamesCount: Array.isArray(upcomingGames) ? upcomingGames.length : 0,
    pastGamesCount: Array.isArray(pastGames) ? pastGames.length : 0,
    hasTeam: participantTeams.length > 0,
    hasUpcomingRegistration,
    profileCompleted,
    nearestGame: nearestGame
      ? {
          id: nearestGame.id || null,
          name: nearestGame.name || 'Без названия',
          status: nearestGame.status || '',
          dateStart: nearestGame.dateStart || null,
        }
      : null,
    personalProgressGames,
    rating,
    recentActivity,
    chatUrl: siteSettings.chatUrl || '',
    chatUrlsByLocation: {
      krsk: typeof chatUrlsByLocation.krsk === 'string' ? chatUrlsByLocation.krsk : '',
      nrsk: typeof chatUrlsByLocation.nrsk === 'string' ? chatUrlsByLocation.nrsk : '',
      ekb: typeof chatUrlsByLocation.ekb === 'string' ? chatUrlsByLocation.ekb : '',
    },
  }
}
