import assertParticipantUserIds from '../helpers/assertParticipantUserIds.js'
import { toStringId } from '../helpers/idAndDate.js'
import { buildRatingRanksV2 } from '../helpers/ratingV2.js'
import {
  getRatingEntryTeamPlaces,
  loadRatedGameEntries,
} from './loadRatedGameEntries.js'

const normalizeLocation = (value) =>
  typeof value === 'string' ? value.trim().toLowerCase() : ''

const resolveParticipantRatingKey = (userId) => {
  if (userId) return `uid:${userId}`
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
      const allTeamsPlaces = getRatingEntryTeamPlaces(game)

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
        const participantKey = resolveParticipantRatingKey(userId)
        const place = allTeamsPlaces.get(toStringId(membership?.teamId))
        if (!participantKey || !Number.isFinite(place)) return

        const previous = playersResults.get(participantKey)
        if (!previous || place < previous.place) {
          playersResults.set(participantKey, buildResult(place))
        }
      })

      const teamsResults = new Map()
      if (game?.participationMode !== 'player') {
        allTeamsPlaces.forEach((place, teamId) => {
          teamsResults.set(resolveTeamRatingKey(teamId), buildResult(place))
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

const buildRatingsForTimeline = (
  timeline,
  selector,
  { scoreMissedGamesAsZero = false } = {},
) => {
  const relevantTimeline = timeline.filter((item) => selector(item).size > 0)
  return buildRatingRanksV2(
    collectResults(relevantTimeline, selector),
    relevantTimeline.length,
    { scoreMissedGamesAsZero },
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

const collectEntityRefs = (games) => {
  const users = new Set()
  const teams = new Set()
  for (const game of games) {
    const teamsUsers = game?.result?.teamsUsers
    if (Array.isArray(teamsUsers)) {
      teamsUsers.forEach((membership) => {
        const userId = toStringId(membership?.userId)
        if (userId) users.add(resolveParticipantRatingKey(userId))
      })
    }
    if (game?.participationMode !== 'player') {
      getRatingEntryTeamPlaces(game).forEach((_, teamId) => {
        teams.add(resolveTeamRatingKey(teamId))
      })
    }
  }
  return { users, teams }
}

const buildRatingUpdate = (snapshots) => snapshots
  ? { $set: snapshots }
  : { $unset: { rating: '', ratingsByLocation: '', ratingsBySeason: '' } }

const updateParticipantsRatings = async ({
  db,
  game,
  updateAllEntities = false,
  affectedGames = [],
  session,
}) => {
  if (!db || !game) return { usersUpdated: 0, teamsUpdated: 0 }
  assertParticipantUserIds([game])

  let previousStage = null
  if (game.stageId && !session) {
    const { refreshPublishedGameStage } = await import('./gameStages.js')
    previousStage = await refreshPublishedGameStage({ db, stageId: game.stageId })
  }
  const gamesToRefresh = previousStage ? [...affectedGames, previousStage] : affectedGames
  const recalculateAllEntities = updateAllEntities || Boolean(previousStage)
  const gameId = toStringId(game?._id)
  const { users: currentUserRefs, teams: currentTeamRefs } = collectEntityRefs([game])
  const { users: affectedUserRefs, teams: affectedTeamRefs } = collectEntityRefs(gamesToRefresh)

  if (
    !recalculateAllEntities &&
    !currentUserRefs.size &&
    !currentTeamRefs.size &&
    !gamesToRefresh.length
  ) {
    return { usersUpdated: 0, teamsUpdated: 0 }
  }

  const ratedGames = await loadRatedGameEntries({ db, session })
  assertParticipantUserIds(ratedGames)
  const timeline = buildTimeline(ratedGames)
  if (!timeline.length && !gamesToRefresh.length) {
    return { usersUpdated: 0, teamsUpdated: 0 }
  }

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
        { scoreMissedGamesAsZero: true },
      ),
    })
    teamRatingsBySeason.set(seasonId, {
      ...scope,
      ratings: buildRatingsForTimeline(
        scope.games,
        (item) => item.teamsResults,
        { scoreMissedGamesAsZero: true },
      ),
    })
  })

  const updatedAt = new Date().toISOString()
  const usersBulkOps = []
  const userKeys = new Set([
    ...(recalculateAllEntities ? globalPlayerRatings.keys() : currentUserRefs),
    ...affectedUserRefs,
  ])
  userKeys.forEach((key) => {
    const filter = resolveUserFilterByRatingKey(key)
    const snapshots = buildEntitySnapshots({
      key,
      globalRatings: globalPlayerRatings,
      locationRatings: playerRatingsByLocation,
      seasonRatings: playerRatingsBySeason,
      sourceGameId: gameId,
      entityType: 'player',
      updatedAt,
    })
    if (!filter || (!snapshots && !affectedUserRefs.has(key))) return
    usersBulkOps.push({
      updateOne: {
        filter,
        update: buildRatingUpdate(snapshots),
      },
    })
  })

  const teamsBulkOps = []
  const teamKeys = new Set([
    ...(recalculateAllEntities ? globalTeamRatings.keys() : currentTeamRefs),
    ...affectedTeamRefs,
  ])
  teamKeys.forEach((key) => {
    const teamId = resolveTeamIdByRatingKey(key)
    const snapshots = buildEntitySnapshots({
      key,
      globalRatings: globalTeamRatings,
      locationRatings: teamRatingsByLocation,
      seasonRatings: teamRatingsBySeason,
      sourceGameId: gameId,
      entityType: 'team',
      updatedAt,
    })
    if (!teamId || (!snapshots && !affectedTeamRefs.has(key))) return
    teamsBulkOps.push({
      updateOne: {
        filter: { _id: teamId },
        update: buildRatingUpdate(snapshots),
      },
    })
  })

  const writeRatings = (modelName, operations) => operations.length
    ? db.model(modelName).bulkWrite(operations, { strict: false, session })
    : Promise.resolve()
  if (session) {
    await writeRatings('Users', usersBulkOps)
    await writeRatings('Teams', teamsBulkOps)
  } else {
    await Promise.all([
      writeRatings('Users', usersBulkOps),
      writeRatings('Teams', teamsBulkOps),
    ])
  }

  return {
    usersUpdated: usersBulkOps.length,
    teamsUpdated: teamsBulkOps.length,
    version: 2,
    locationsUpdated: Array.from(locationScopes.keys()),
    seasonsUpdated: Array.from(seasonScopes.keys()),
  }
}

export default updateParticipantsRatings
