import normalizeGameForCabinet from '@helpers/normalizeGameForCabinet'
import { toStringId } from '@helpers/idAndDate'

const toPositiveInteger = (value, fallback) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric < 0) {
    return fallback
  }
  return Math.floor(numeric)
}

const toDate = (value) => {
  const date = value ? new Date(value) : null
  return date && !Number.isNaN(date.getTime()) ? date : null
}

const resolveTeamsPlace = (teamsPlaces, teamId) => {
  if (!teamsPlaces || !teamId) {
    return null
  }

  if (typeof teamsPlaces.get === 'function') {
    const mapValue = teamsPlaces.get(teamId)
    const numeric = Number(mapValue)
    return Number.isFinite(numeric) ? numeric : null
  }

  if (typeof teamsPlaces === 'object') {
    const objectValue = teamsPlaces[teamId]
    const numeric = Number(objectValue)
    return Number.isFinite(numeric) ? numeric : null
  }

  return null
}

const buildGamesQuery = ({
  location,
  userRole,
  creatorTelegramId,
  view,
}) => {
  const normalizedLocation =
    typeof location === 'string' ? location.trim().toLowerCase() : null

  const canLoadAllGames = userRole === 'admin' || userRole === 'dev'
  const canSeeClosedStatus = userRole === 'admin' || userRole === 'dev'
  const canLoadOwnGames = userRole === 'moder' && creatorTelegramId !== null
  const canLoadPublicGames = !canLoadAllGames && !canLoadOwnGames

  if (!canLoadAllGames && !canLoadOwnGames && !canLoadPublicGames) {
    return null
  }

  const query = canLoadAllGames
    ? {}
    : canLoadOwnGames
      ? { creatorTelegramId }
      : { hidden: { $ne: true } }

  if (normalizedLocation) {
    query.location = normalizedLocation
  }

  const now = new Date()
  if (view === 'upcoming') {
    query.$or = [
      { dateStart: { $gte: now } },
      { dateStart: null, status: { $in: ['active', 'started'] } },
    ]
  } else if (view === 'past') {
    query.$or = [
      { dateStart: { $lt: now } },
      { status: { $in: ['finished', 'closed', 'canceled'] } },
    ]
  }

  return { query, canSeeClosedStatus }
}

const fetchGamesForCabinet = async ({
  db,
  location,
  userRole,
  creatorTelegramId = null,
  currentUserId = null,
  currentUserTelegramId = null,
  offset = 0,
  limit = 10,
  view = 'all',
}) => {
  if (!db) {
    return { games: [], hasMore: false }
  }

  const queryData = buildGamesQuery({
    location,
    userRole,
    creatorTelegramId,
    view,
  })

  const query = queryData?.query
  const canSeeClosedStatus = Boolean(queryData?.canSeeClosedStatus)

  if (!query) {
    return { games: [], hasMore: false }
  }

  const GamesModel = db.model('Games')
  const GamesTeamsModel = db.model('GamesTeams')
  const TeamsUsersModel = db.model('TeamsUsers')

  const queryOffset = toPositiveInteger(offset, 0)
  const queryLimit = toPositiveInteger(limit, 10)
  const fetchLimit = queryLimit + 1

  const gamesDocsRaw = await GamesModel.find(query)
    .sort({ updatedAt: -1 })
    .skip(queryOffset)
    .limit(fetchLimit)
    .select({
      _id: 1,
      name: 1,
      status: 1,
      dateStart: 1,
      dateStartFact: 1,
      dateEndFact: 1,
      type: 1,
      description: 1,
      image: 1,
      startingPlace: 1,
      finishingPlace: 1,
      taskDuration: 1,
      cluesDuration: 1,
      clueEarlyAccessMode: 1,
      clueEarlyPenalty: 1,
      allowCaptainForceClue: 1,
      allowCaptainFailTask: 1,
      allowCaptainFinishBreak: 1,
      breakDuration: 1,
      taskFailurePenalty: 1,
      manyCodesPenalty: 1,
      individualStart: 1,
      isRated: 1,
      hidden: 1,
      showCreator: 1,
      showTasks: 1,
      hideResult: 1,
      prices: 1,
      finances: 1,
      tasks: 1,
      updatedAt: 1,
      createdAt: 1,
      creatorTelegramId: 1,
      moderators: 1,
      location: 1,
      'result.computed': 1,
      'result.teamsPlaces': 1,
    })
    .populate({
      path: 'moderators',
      select: { _id: 1, name: 1, username: 1, telegramId: 1 },
    })
    .lean()

  const hasMore = gamesDocsRaw.length > queryLimit
  const gamesDocs = gamesDocsRaw.slice(0, queryLimit)

  if (!gamesDocs.length) {
    return { games: [], hasMore }
  }

  const now = new Date()
  const gamesFiltered = gamesDocs.filter((game) => {
    if (view === 'all') {
      return true
    }

    const startDate = toDate(game?.dateStart)

    if (view === 'upcoming') {
      if (startDate && startDate >= now) {
        return true
      }
      return game?.status === 'active' || game?.status === 'started'
    }

    if (view === 'past') {
      if (startDate && startDate < now) {
        return true
      }
      return (
        game?.status === 'finished' ||
        game?.status === 'closed' ||
        game?.status === 'canceled'
      )
    }

    return true
  })

  const gameIds = gamesFiltered
    .map((game) => (game?._id ? game._id.toString() : null))
    .filter(Boolean)

  let teamsCountMap = {}
  if (gameIds.length) {
    const gamesTeams = await GamesTeamsModel.find({ gameId: { $in: gameIds } })
      .select({ gameId: 1, teamId: 1 })
      .lean()

    teamsCountMap = gamesTeams.reduce((acc, doc) => {
      if (!doc?.gameId) {
        return acc
      }

      const key = String(doc.gameId)
      acc[key] = (acc[key] ?? 0) + 1
      return acc
    }, {})

    const currentUserIdString = toStringId(currentUserId)
    const currentUserTelegramIdNumber = Number(currentUserTelegramId)
    const hasUserId = Boolean(currentUserIdString)
    const hasTelegramId = Number.isFinite(currentUserTelegramIdNumber)

    let userTeamPlaceByGameId = {}
    if (gamesTeams.length > 0 && (hasUserId || hasTelegramId)) {
      const teamIds = Array.from(
        new Set(gamesTeams.map((doc) => toStringId(doc?.teamId)).filter(Boolean))
      )

      const membershipOr = []
      if (hasUserId) {
        membershipOr.push({ userId: currentUserIdString })
      }
      if (hasTelegramId) {
        membershipOr.push({ userTelegramId: currentUserTelegramIdNumber })
      }

      const memberships = teamIds.length && membershipOr.length
        ? await TeamsUsersModel.find({
            teamId: { $in: teamIds },
            $or: membershipOr,
          })
            .select({ teamId: 1 })
            .lean()
        : []

      const userTeamIdsSet = new Set(
        memberships.map((doc) => toStringId(doc?.teamId)).filter(Boolean)
      )
      const userTeamIdsByGameId = gamesTeams.reduce((acc, doc) => {
        const gameId = toStringId(doc?.gameId)
        const teamId = toStringId(doc?.teamId)
        if (!gameId || !teamId || !userTeamIdsSet.has(teamId)) {
          return acc
        }

        if (!acc[gameId]) {
          acc[gameId] = []
        }
        acc[gameId].push(teamId)
        return acc
      }, {})

      userTeamPlaceByGameId = gamesFiltered.reduce((acc, game) => {
        const gameId = toStringId(game?._id)
        if (!gameId) {
          return acc
        }

        const userTeamIds = userTeamIdsByGameId[gameId]
        if (!Array.isArray(userTeamIds) || userTeamIds.length === 0) {
          return acc
        }

        const places = userTeamIds
          .map((teamId) => resolveTeamsPlace(game?.result?.teamsPlaces, teamId))
          .filter((place) => Number.isFinite(place))
          .map(Number)

        if (places.length === 0) {
          return acc
        }

        acc[gameId] = Math.min(...places)
        return acc
      }, {})
    }

    const games = gamesFiltered.map((game) => {
      const normalizedStatus =
        game?.status === 'closed' && !canSeeClosedStatus ? 'finished' : game?.status
      const gameId = game?._id ? game._id.toString() : null

      return normalizeGameForCabinet({
        ...game,
        status: normalizedStatus,
        teamsCount: gameId ? teamsCountMap[gameId] ?? 0 : 0,
        userTeamPlace: gameId ? userTeamPlaceByGameId[gameId] ?? null : null,
      })
    })

    return { games, hasMore }
  }

  const games = gamesFiltered.map((game) => {
    const normalizedStatus =
      game?.status === 'closed' && !canSeeClosedStatus ? 'finished' : game?.status

    return normalizeGameForCabinet({
      ...game,
      status: normalizedStatus,
      teamsCount: game?._id ? teamsCountMap[game._id.toString()] ?? 0 : 0,
      userTeamPlace: null,
    })
  })

  return { games, hasMore }
}

export default fetchGamesForCabinet
