import normalizeGameForCabinet from '@helpers/normalizeGameForCabinet'

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

const buildGamesQuery = ({
  location,
  userRole,
  creatorTelegramId,
  view,
}) => {
  const normalizedLocation =
    typeof location === 'string' ? location.trim().toLowerCase() : null

  const canLoadAllGames = userRole === 'admin' || userRole === 'dev'
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
      { status: { $in: ['finished', 'canceled'] } },
    ]
  }

  return query
}

const fetchGamesForCabinet = async ({
  db,
  location,
  userRole,
  creatorTelegramId = null,
  offset = 0,
  limit = 10,
  view = 'all',
}) => {
  if (!db) {
    return { games: [], hasMore: false }
  }

  const query = buildGamesQuery({
    location,
    userRole,
    creatorTelegramId,
    view,
  })

  if (!query) {
    return { games: [], hasMore: false }
  }

  const GamesModel = db.model('Games')
  const GamesTeamsModel = db.model('GamesTeams')

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
      return game?.status === 'finished' || game?.status === 'canceled'
    }

    return true
  })

  const gameIds = gamesFiltered
    .map((game) => (game?._id ? game._id.toString() : null))
    .filter(Boolean)

  let teamsCountMap = {}
  if (gameIds.length) {
    const gamesTeams = await GamesTeamsModel.find({ gameId: { $in: gameIds } })
      .select({ gameId: 1 })
      .lean()

    teamsCountMap = gamesTeams.reduce((acc, doc) => {
      if (!doc?.gameId) {
        return acc
      }

      const key = String(doc.gameId)
      acc[key] = (acc[key] ?? 0) + 1
      return acc
    }, {})
  }

  const games = gamesFiltered.map((game) =>
    normalizeGameForCabinet({
      ...game,
      teamsCount: game?._id ? teamsCountMap[game._id.toString()] ?? 0 : 0,
    })
  )

  return { games, hasMore }
}

export default fetchGamesForCabinet
