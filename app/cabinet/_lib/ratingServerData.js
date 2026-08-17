import dbConnectGlobal from '@utils/dbConnectGlobal'
import { toStringId } from '@helpers/idAndDate'
import { calculateRatingGameScore } from '@helpers/ratingV2'
import { LOCATIONS } from '@server/serverConstants'

const TOP_LIMIT = 10

const normalizeLocation = (value) =>
  typeof value === 'string' ? value.trim().toLowerCase() : ''

const resolveRatingField = ({ location, seasonId }) => {
  if (seasonId) return `ratingsBySeason.${seasonId}`
  return location ? `ratingsByLocation.${location}` : 'rating'
}

const buildEligibleRatingFilter = (ratingField, scope) => ({
  [`${ratingField}.version`]: 2,
  [`${ratingField}.scope`]: scope,
  [`${ratingField}.isEligible`]: true,
  [`${ratingField}.rank`]: { $type: 'number' },
  [`${ratingField}.finalScore`]: { $type: 'number' },
})

const resolveSessionUserId = (session) =>
  toStringId(
    session?.user?.globalUserId ??
      session?.user?.userId ??
      session?.user?._id ??
      session?.user?.id,
  )

const normalizeRating = (rating) => {
  const toNumberOrNull = (value) => {
    if (value === null || value === undefined || value === '') return null
    const numeric = Number(value)
    return Number.isFinite(numeric) ? numeric : null
  }

  if (!rating || typeof rating !== 'object') {
    return {
      isEligible: false,
      version: 2,
      rank: null,
      totalRanked: 0,
      finalScore: null,
      averagePlace: null,
      stdDevPlace: null,
      stdDevScore: null,
      attendance: null,
      playedGames: 0,
      totalGames: 0,
      missedGames: 0,
      wins: 0,
      seasonId: null,
      seasonName: null,
      updatedAt: null,
    }
  }

  return {
    version: toNumberOrNull(rating.version) ?? 1,
    isEligible: Boolean(rating.isEligible),
    rank: toNumberOrNull(rating.rank),
    totalRanked: toNumberOrNull(rating.totalRanked) ?? 0,
    finalScore: toNumberOrNull(rating.finalScore),
    averagePlace: toNumberOrNull(rating.averagePlace),
    stdDevPlace: toNumberOrNull(rating.stdDevPlace),
    stdDevScore: toNumberOrNull(rating.stdDevScore),
    attendance: toNumberOrNull(rating.attendance),
    playedGames: toNumberOrNull(rating.playedGames) ?? 0,
    totalGames: toNumberOrNull(rating.totalGames) ?? 0,
    missedGames: toNumberOrNull(rating.missedGames) ?? 0,
    wins: toNumberOrNull(rating.wins) ?? 0,
    seasonId: typeof rating.seasonId === 'string' ? rating.seasonId : null,
    seasonName:
      typeof rating.seasonName === 'string' ? rating.seasonName : null,
    updatedAt:
      rating.updatedAt instanceof Date
        ? rating.updatedAt.toISOString()
        : typeof rating.updatedAt === 'string'
          ? rating.updatedAt
          : null,
  }
}

const resolveDocumentRating = (document, { location, seasonId }) => {
  if (seasonId) return document?.ratingsBySeason?.[seasonId]
  return location ? document?.ratingsByLocation?.[location] : document?.rating
}

const normalizePlayer = (user, currentUserId, ratingScope) => ({
  id: toStringId(user?._id) || '',
  name: user?.name?.trim() || user?.username?.trim() || 'Игрок ActQuest',
  username: user?.username?.trim() || null,
  image: user?.photoUrl || null,
  isCurrent: toStringId(user?._id) === currentUserId,
  rating: normalizeRating(resolveDocumentRating(user, ratingScope)),
})

const normalizeTeam = (team, currentTeamIds, ratingScope) => {
  const id = toStringId(team?._id) || ''
  return {
    id,
    name: team?.name?.trim() || 'Команда ActQuest',
    image: team?.image || null,
    isCurrent: currentTeamIds.has(id),
    rating: normalizeRating(resolveDocumentRating(team, ratingScope)),
  }
}

const compareRatingRows = (first, second) => {
  if (first.rating.isEligible !== second.rating.isEligible) {
    return first.rating.isEligible ? -1 : 1
  }

  const firstRank = first.rating.rank ?? Number.POSITIVE_INFINITY
  const secondRank = second.rating.rank ?? Number.POSITIVE_INFINITY
  if (firstRank !== secondRank) {
    return firstRank - secondRank
  }

  return first.name.localeCompare(second.name, 'ru', { sensitivity: 'base' })
}

const getObjectEntries = (value) =>
  value instanceof Map ? Array.from(value.entries()) : Object.entries(value || {})

const loadTeamsRatingBreakdown = async ({
  db,
  teamIds,
  location,
  seasonId,
}) => {
  if (!teamIds.length) return new Map()

  const games = await db
    .model('Games')
    .find({
      status: 'closed',
      isRated: { $ne: false },
      participationMode: { $ne: 'player' },
      ...(location ? { location } : {}),
      ...(seasonId ? { seasonId } : {}),
    })
    .select({ _id: 1, name: 1, dateStart: 1, 'result.teamsPlaces': 1 })
    .sort({ dateStart: 1, _id: 1 })
    .lean()

  const requestedTeamIds = new Set(teamIds)
  const breakdownByTeamId = new Map(
    teamIds.map((teamId) => [teamId, []]),
  )

  games.forEach((game) => {
    const validPlaces = getObjectEntries(game?.result?.teamsPlaces)
      .map(([teamId, place]) => [toStringId(teamId), Number(place)])
      .filter(([teamId, place]) => teamId && Number.isFinite(place))
    const participantsCount = validPlaces.length
    if (participantsCount < 2) return

    validPlaces.forEach(([teamId, place]) => {
      if (!requestedTeamIds.has(teamId)) return
      const score = calculateRatingGameScore({ place, participantsCount })
      if (!Number.isFinite(score)) return

      breakdownByTeamId.get(teamId)?.push({
        gameId: toStringId(game?._id) || '',
        gameName: game?.name?.trim() || 'Игра ActQuest',
        dateStart:
          game?.dateStart instanceof Date
            ? game.dateStart.toISOString()
            : typeof game?.dateStart === 'string'
              ? game.dateStart
              : null,
        place,
        participantsCount,
        score,
      })
    })
  })

  return breakdownByTeamId
}

const loadPlayersRating = async ({ db, currentUserId, location, seasonId }) => {
  const Users = db.model('Users')
  const ratingScope = { location, seasonId }
  const ratingField = resolveRatingField(ratingScope)
  const snapshotScope = seasonId
    ? 'season'
    : location
      ? 'location-all-time'
      : 'all-time'
  const projection = {
    name: 1,
    username: 1,
    photoUrl: 1,
    rating: 1,
    ratingsByLocation: 1,
    ratingsBySeason: 1,
  }
  const [topDocs, currentUserDoc] = await Promise.all([
    Users.find(buildEligibleRatingFilter(ratingField, snapshotScope))
      .select(projection)
      .sort({ [`${ratingField}.rank`]: 1, _id: 1 })
      .limit(TOP_LIMIT)
      .lean(),
    currentUserId
      ? Users.findById(currentUserId).select(projection).lean()
      : Promise.resolve(null),
  ])

  const top = (topDocs || []).map((user) =>
    normalizePlayer(user, currentUserId, ratingScope),
  )
  const topIds = new Set(top.map((item) => item.id))
  const current = currentUserDoc
    ? normalizePlayer(currentUserDoc, currentUserId, ratingScope)
    : null

  return {
    top,
    personal: current && !topIds.has(current.id) ? [current] : [],
  }
}

const loadTeamsRating = async ({ db, currentUserId, location, seasonId }) => {
  const Teams = db.model('Teams')
  const TeamsUsers = db.model('TeamsUsers')
  const ratingScope = { location, seasonId }
  const ratingField = resolveRatingField(ratingScope)
  const snapshotScope = seasonId
    ? 'season'
    : location
      ? 'location-all-time'
      : 'all-time'
  const projection = {
    name: 1,
    image: 1,
    rating: 1,
    ratingsByLocation: 1,
    ratingsBySeason: 1,
  }
  const [topDocs, memberships] = await Promise.all([
    Teams.find({
      ...buildEligibleRatingFilter(ratingField, snapshotScope),
      kind: { $ne: 'personal' },
    })
      .select(projection)
      .sort({ [`${ratingField}.rank`]: 1, _id: 1 })
      .limit(TOP_LIMIT)
      .lean(),
    currentUserId
      ? TeamsUsers.find({ userId: currentUserId }).select({ teamId: 1 }).lean()
      : Promise.resolve([]),
  ])

  const currentTeamIds = new Set(
    (memberships || [])
      .map((membership) => toStringId(membership?.teamId))
      .filter(Boolean),
  )
  const top = (topDocs || []).map((team) =>
    normalizeTeam(team, currentTeamIds, ratingScope),
  )
  const topIds = new Set(top.map((item) => item.id))

  const personalDocs = currentTeamIds.size
    ? await Teams.find({
        _id: { $in: Array.from(currentTeamIds) },
        kind: { $ne: 'personal' },
      })
        .select(projection)
        .lean()
    : []
  const personal = (personalDocs || [])
    .map((team) => normalizeTeam(team, currentTeamIds, ratingScope))
    .filter((team) => !topIds.has(team.id))
    .sort(compareRatingRows)

  const displayedTeamIds = Array.from(
    new Set([...top, ...personal].map((team) => team.id).filter(Boolean)),
  )
  const breakdownByTeamId = await loadTeamsRatingBreakdown({
    db,
    teamIds: displayedTeamIds,
    location,
    seasonId,
  })
  const withBreakdown = (team) => ({
    ...team,
    rating: {
      ...team.rating,
      breakdown: breakdownByTeamId.get(team.id) || [],
    },
  })

  return {
    top: top.map(withBreakdown),
    personal: personal.map(withBreakdown),
  }
}

const loadLocationSeasons = async ({ db, location }) => {
  if (!location) return []
  const games = await db
    .model('Games')
    .find({
      status: 'closed',
      isRated: { $ne: false },
      location,
      seasonId: { $nin: [null, ''] },
    })
    .select({ seasonId: 1, seasonName: 1, dateStart: 1 })
    .sort({ dateStart: -1, _id: -1 })
    .lean()
  const seasons = new Map()
  games.forEach((game) => {
    const id = toStringId(game?.seasonId)
    if (!id || seasons.has(id)) return
    seasons.set(id, {
      id,
      name:
        typeof game?.seasonName === 'string' && game.seasonName.trim()
          ? game.seasonName.trim()
          : 'Сезон без названия',
    })
  })
  return Array.from(seasons.values())
}

export const loadCabinetRating = async ({ session, type, seasonId = null }) => {
  const db = await dbConnectGlobal()
  const currentUserId = resolveSessionUserId(session)
  const location = normalizeLocation(session?.user?.location)
  const rawCityName = location ? LOCATIONS?.[location]?.townRu : ''
  const cityName = rawCityName
    ? rawCityName.charAt(0).toUpperCase() + rawCityName.slice(1)
    : null
  const seasons = db ? await loadLocationSeasons({ db, location }) : []
  const requestedSeasonId = toStringId(seasonId)
  const selectedSeasonId = seasons.some(
    (season) => season.id === requestedSeasonId,
  )
    ? requestedSeasonId
    : null

  if (!db) {
    return {
      top: [],
      personal: [],
      location: location || null,
      cityName,
      seasons,
      selectedSeasonId,
    }
  }

  if (type === 'players') {
    return {
      ...(await loadPlayersRating({
        db,
        currentUserId,
        location,
        seasonId: selectedSeasonId,
      })),
      location: location || null,
      cityName,
      seasons,
      selectedSeasonId,
    }
  }

  return {
    ...(await loadTeamsRating({
      db,
      currentUserId,
      location,
      seasonId: selectedSeasonId,
    })),
    location: location || null,
    cityName,
    seasons,
    selectedSeasonId,
  }
}
