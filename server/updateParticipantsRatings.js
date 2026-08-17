import { toStringId } from '@helpers/idAndDate'
import { buildRatingRanksV2 } from '@helpers/ratingV2'

const normalizeLocation = (value) =>
  typeof value === 'string' ? value.trim().toLowerCase() : ''

const getObjectEntries = (value) =>
  value instanceof Map ? Array.from(value.entries()) : Object.entries(value || {})

const resolveParticipantRatingKey = (userId, telegramId) => {
  if (userId) return `uid:${userId}`
  if (Number.isFinite(telegramId)) return `tg:${telegramId}`
  return null
}

const resolveTeamRatingKey = (teamId) => {
  const normalized = toStringId(teamId)
  return normalized ? `team:${normalized}` : null
}

const resolveUserFilterByRatingKey = (key) => {
  if (typeof key !== 'string') return null
  if (key.startsWith('uid:')) {
    const userId = toStringId(key.slice(4))
    return userId ? { _id: userId } : null
  }
  if (key.startsWith('tg:')) {
    const telegramId = Number(key.slice(3))
    return Number.isFinite(telegramId) ? { telegramId } : null
  }
  return null
}

const resolveTeamIdByRatingKey = (key) => {
  if (typeof key !== 'string' || !key.startsWith('team:')) return null
  return toStringId(key.slice(5))
}

const buildTimeline = (games) =>
  games
    .map((game) => {
      const result =
        game?.result && typeof game.result === 'object' ? game.result : {}
      const rawPlaces =
        result?.teamsPlaces && typeof result.teamsPlaces === 'object'
          ? result.teamsPlaces
          : {}
      const allTeamsPlaces = new Map()

      getObjectEntries(rawPlaces).forEach(([teamId, place]) => {
        const key = resolveTeamRatingKey(teamId)
        const numericPlace = Number(place)
        if (key && Number.isFinite(numericPlace)) {
          allTeamsPlaces.set(key, numericPlace)
        }
      })

      const participantsCount = allTeamsPlaces.size
      if (participantsCount < 2) return null

      const gameId = toStringId(game?._id) || ''
      const startedAt = game?.dateStart
        ? new Date(game.dateStart).getTime()
        : Number.NaN
      const normalizedStartedAt = Number.isFinite(startedAt)
        ? startedAt
        : Number.POSITIVE_INFINITY
      const buildResult = (place) => ({
        gameId,
        place,
        participantsCount,
        startedAt: normalizedStartedAt,
      })

      const playersResults = new Map()
      const teamsUsers = Array.isArray(result?.teamsUsers)
        ? result.teamsUsers
        : []
      teamsUsers.forEach((membership) => {
        const userId = toStringId(membership?.userId)
        const telegramId = Number(membership?.userTelegramId)
        const participantKey = resolveParticipantRatingKey(userId, telegramId)
        const teamKey = resolveTeamRatingKey(membership?.teamId)
        const place = teamKey ? allTeamsPlaces.get(teamKey) : null
        if (!participantKey || !Number.isFinite(place)) return

        const previous = playersResults.get(participantKey)
        if (!previous || place < previous.place) {
          playersResults.set(participantKey, buildResult(place))
        }
      })

      const teamsResults = new Map()
      if (game?.participationMode !== 'player') {
        allTeamsPlaces.forEach((place, key) => {
          teamsResults.set(key, buildResult(place))
        })
      }
      if (!playersResults.size && !teamsResults.size) return null

      return {
        id: gameId,
        startedAt: normalizedStartedAt,
        location: normalizeLocation(game?.location),
        seasonId: toStringId(game?.seasonId),
        seasonName:
          typeof game?.seasonName === 'string' ? game.seasonName.trim() : '',
        playersResults,
        teamsResults,
      }
    })
    .filter(Boolean)
    .sort((first, second) => {
      if (first.startedAt !== second.startedAt) {
        return first.startedAt - second.startedAt
      }
      return first.id.localeCompare(second.id, 'ru')
    })

const collectResults = (timeline, selector) => {
  const resultsByKey = new Map()
  timeline.forEach((item) => {
    selector(item).forEach((result, key) => {
      if (!resultsByKey.has(key)) resultsByKey.set(key, [])
      resultsByKey.get(key).push(result)
    })
  })
  return resultsByKey
}

const resolveAllTimeScopesByLocation = (timeline) => {
  const gamesByLocation = new Map()
  timeline.forEach((item) => {
    if (!item.location) return
    if (!gamesByLocation.has(item.location)) gamesByLocation.set(item.location, [])
    gamesByLocation.get(item.location).push(item)
  })

  const scopes = new Map()
  gamesByLocation.forEach((games, location) => {
    scopes.set(location, {
      location,
      seasonId: null,
      seasonName: null,
      games,
    })
  })
  return scopes
}

const resolveSeasonScopes = (timeline) => {
  const scopes = new Map()
  timeline.forEach((item) => {
    if (!item.location || !item.seasonId) return
    if (!scopes.has(item.seasonId)) {
      scopes.set(item.seasonId, {
        location: item.location,
        seasonId: item.seasonId,
        seasonName: item.seasonName || null,
        games: [],
      })
    }
    scopes.get(item.seasonId).games.push(item)
  })
  return scopes
}

const buildRatingsForTimeline = (timeline, selector) => {
  const relevantTimeline = timeline.filter((item) => selector(item).size > 0)
  return buildRatingRanksV2(
    collectResults(relevantTimeline, selector),
    relevantTimeline.length,
  )
}

const optionalNumber = (value) => {
  if (value === null || value === undefined || value === '') return null
  return Number.isFinite(Number(value)) ? Number(value) : null
}

const buildRatingSnapshot = ({
  rating,
  location,
  seasonId,
  seasonName,
  scope,
  sourceGameId,
  entityType,
  updatedAt,
}) => ({
  version: 2,
  entityType,
  scope,
  scoreDirection: 'desc',
  location: location || null,
  seasonId: seasonId || null,
  seasonName: seasonName || null,
  sourceGameId: sourceGameId || null,
  updatedAt,
  isEligible: Boolean(rating?.isEligible),
  rank: optionalNumber(rating?.rank),
  totalRanked: optionalNumber(rating?.totalRanked) ?? 0,
  playersAbove: optionalNumber(rating?.playersAbove),
  ratingPoints: optionalNumber(rating?.finalScore),
  finalScore: optionalNumber(rating?.finalScore),
  averageScore: optionalNumber(rating?.averageScore),
  averagePlace: optionalNumber(rating?.averagePlace),
  stdDevScore: optionalNumber(rating?.stdDevScore),
  latestScore: optionalNumber(rating?.latestScore),
  attendance: optionalNumber(rating?.attendance),
  playedGames: optionalNumber(rating?.playedGames) ?? 0,
  totalGames: optionalNumber(rating?.totalGames) ?? 0,
  missedGames: optionalNumber(rating?.missedGames) ?? 0,
  wins: optionalNumber(rating?.wins) ?? 0,
})

const buildEntitySnapshots = ({
  key,
  globalRatings,
  locationRatings,
  seasonRatings,
  sourceGameId,
  entityType,
  updatedAt,
}) => {
  const globalRating = globalRatings.get(key)
  if (!globalRating) return null

  const rating = buildRatingSnapshot({
    rating: globalRating,
    location: null,
    seasonId: null,
    seasonName: null,
    scope: 'all-time',
    sourceGameId,
    entityType,
    updatedAt,
  })
  const ratingsByLocation = {}
  locationRatings.forEach((locationScope, location) => {
    const locationRating = locationScope.ratings.get(key)
    if (!locationRating) return
    ratingsByLocation[location] = buildRatingSnapshot({
      rating: locationRating,
      location,
      seasonId: locationScope.seasonId,
      seasonName: locationScope.seasonName,
      scope: 'location-all-time',
      sourceGameId,
      entityType,
      updatedAt,
    })
  })
  const ratingsBySeason = {}
  seasonRatings.forEach((seasonScope, seasonId) => {
    const seasonRating = seasonScope.ratings.get(key)
    if (!seasonRating) return
    ratingsBySeason[seasonId] = buildRatingSnapshot({
      rating: seasonRating,
      location: seasonScope.location,
      seasonId,
      seasonName: seasonScope.seasonName,
      scope: 'season',
      sourceGameId,
      entityType,
      updatedAt,
    })
  })
  return { rating, ratingsByLocation, ratingsBySeason }
}

const updateParticipantsRatings = async ({
  db,
  game,
  updateAllEntities = false,
}) => {
  if (!db || !game) return { usersUpdated: 0, teamsUpdated: 0 }

  const gameId = toStringId(game?._id)
  const result =
    game?.result && typeof game.result === 'object' ? game.result : {}
  const teamsUsers = Array.isArray(result?.teamsUsers) ? result.teamsUsers : []
  const teamsPlaces =
    result?.teamsPlaces && typeof result.teamsPlaces === 'object'
      ? result.teamsPlaces
      : {}

  const currentUserRefs = new Map()
  teamsUsers.forEach((membership) => {
    const userId = toStringId(membership?.userId)
    const telegramId = Number(membership?.userTelegramId)
    const key = resolveParticipantRatingKey(userId, telegramId)
    if (key && userId) currentUserRefs.set(key, { _id: userId })
    else if (key && Number.isFinite(telegramId)) {
      currentUserRefs.set(key, { telegramId })
    }
  })

  const currentTeamRefs = new Map()
  if (game?.participationMode !== 'player') {
    getObjectEntries(teamsPlaces).forEach(([teamId]) => {
      const key = resolveTeamRatingKey(teamId)
      const normalizedTeamId = toStringId(teamId)
      if (key && normalizedTeamId) currentTeamRefs.set(key, normalizedTeamId)
    })
  }
  if (!updateAllEntities && !currentUserRefs.size && !currentTeamRefs.size) {
    return { usersUpdated: 0, teamsUpdated: 0 }
  }

  const ratedGames = await db
    .model('Games')
    .find({ status: 'closed', isRated: { $ne: false } })
    .select({
      _id: 1,
      dateStart: 1,
      location: 1,
      seasonId: 1,
      seasonName: 1,
      participationMode: 1,
      result: 1,
    })
    .lean()
  const timeline = buildTimeline(ratedGames)
  if (!timeline.length) return { usersUpdated: 0, teamsUpdated: 0 }

  const globalPlayerRatings = buildRatingsForTimeline(
    timeline,
    (item) => item.playersResults,
  )
  const globalTeamRatings = buildRatingsForTimeline(
    timeline,
    (item) => item.teamsResults,
  )
  const locationScopes = resolveAllTimeScopesByLocation(timeline)
  const seasonScopes = resolveSeasonScopes(timeline)
  const playerRatingsByLocation = new Map()
  const teamRatingsByLocation = new Map()
  const playerRatingsBySeason = new Map()
  const teamRatingsBySeason = new Map()
  locationScopes.forEach((scope, location) => {
    playerRatingsByLocation.set(location, {
      ...scope,
      ratings: buildRatingsForTimeline(
        scope.games,
        (item) => item.playersResults,
      ),
    })
    teamRatingsByLocation.set(location, {
      ...scope,
      ratings: buildRatingsForTimeline(scope.games, (item) => item.teamsResults),
    })
  })
  seasonScopes.forEach((scope, seasonId) => {
    playerRatingsBySeason.set(seasonId, {
      ...scope,
      ratings: buildRatingsForTimeline(
        scope.games,
        (item) => item.playersResults,
      ),
    })
    teamRatingsBySeason.set(seasonId, {
      ...scope,
      ratings: buildRatingsForTimeline(scope.games, (item) => item.teamsResults),
    })
  })

  const updatedAt = new Date().toISOString()
  const usersBulkOps = []
  const userKeys = updateAllEntities
    ? Array.from(globalPlayerRatings.keys())
    : Array.from(currentUserRefs.keys())
  userKeys.forEach((key) => {
    const filter = updateAllEntities
      ? resolveUserFilterByRatingKey(key)
      : currentUserRefs.get(key)
    const snapshots = buildEntitySnapshots({
      key,
      globalRatings: globalPlayerRatings,
      locationRatings: playerRatingsByLocation,
      seasonRatings: playerRatingsBySeason,
      sourceGameId: gameId,
      entityType: 'player',
      updatedAt,
    })
    if (!filter || !snapshots) return
    usersBulkOps.push({
      [filter._id ? 'updateOne' : 'updateMany']: {
        filter,
        update: { $set: snapshots },
      },
    })
  })

  const teamsBulkOps = []
  const teamKeys = updateAllEntities
    ? Array.from(globalTeamRatings.keys())
    : Array.from(currentTeamRefs.keys())
  teamKeys.forEach((key) => {
    const teamId = updateAllEntities
      ? resolveTeamIdByRatingKey(key)
      : currentTeamRefs.get(key)
    const snapshots = buildEntitySnapshots({
      key,
      globalRatings: globalTeamRatings,
      locationRatings: teamRatingsByLocation,
      seasonRatings: teamRatingsBySeason,
      sourceGameId: gameId,
      entityType: 'team',
      updatedAt,
    })
    if (!teamId || !snapshots) return
    teamsBulkOps.push({
      updateOne: {
        filter: { _id: teamId },
        update: { $set: snapshots },
      },
    })
  })

  await Promise.all([
    usersBulkOps.length
      ? db.model('Users').bulkWrite(usersBulkOps, { strict: false })
      : Promise.resolve(),
    teamsBulkOps.length
      ? db.model('Teams').bulkWrite(teamsBulkOps, { strict: false })
      : Promise.resolve(),
  ])

  return {
    usersUpdated: usersBulkOps.length,
    teamsUpdated: teamsBulkOps.length,
    version: 2,
    locationsUpdated: Array.from(locationScopes.keys()),
    seasonsUpdated: Array.from(seasonScopes.keys()),
  }
}

export default updateParticipantsRatings
