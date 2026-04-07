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

const resolveGamesSort = (view) => {
  if (view === 'upcoming') {
    return { dateStart: 1, _id: 1 }
  }
  if (view === 'past') {
    return { dateStart: -1, _id: 1 }
  }
  return { updatedAt: -1, _id: 1 }
}

const sortGamesByView = (games, view) => {
  const items = Array.isArray(games) ? [...games] : []

  if (view === 'upcoming') {
    return items.sort((first, second) => {
      const firstDate = toDate(first?.dateStart)
      const secondDate = toDate(second?.dateStart)
      const firstTime = firstDate
        ? firstDate.getTime()
        : Number.POSITIVE_INFINITY
      const secondTime = secondDate
        ? secondDate.getTime()
        : Number.POSITIVE_INFINITY
      if (firstTime !== secondTime) {
        return firstTime - secondTime
      }
      return String(first?.id || '').localeCompare(
        String(second?.id || ''),
        'ru',
      )
    })
  }

  if (view === 'past') {
    return items.sort((first, second) => {
      const firstDate = toDate(first?.dateStart)
      const secondDate = toDate(second?.dateStart)
      const firstTime = firstDate
        ? firstDate.getTime()
        : Number.NEGATIVE_INFINITY
      const secondTime = secondDate
        ? secondDate.getTime()
        : Number.NEGATIVE_INFINITY
      if (firstTime !== secondTime) {
        return secondTime - firstTime
      }
      return String(second?.id || '').localeCompare(
        String(first?.id || ''),
        'ru',
      )
    })
  }

  return items
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

  const GamesModel = db.model('Games')

  const currentUserIdString = toStringId(currentUserId)
  const currentUserTelegramIdNumber = Number(currentUserTelegramId)
  const hasUserId = Boolean(currentUserIdString)
  const hasTelegramId = Number.isFinite(currentUserTelegramIdNumber)
  const isElevatedRole = userRole === 'admin' || userRole === 'dev'

  // Построить базовый query
  const query = {}

  // Фильтр по location
  const normalizedLocation =
    typeof location === 'string' ? location.trim().toLowerCase() : null
  if (normalizedLocation) {
    query.location = normalizedLocation
  }

  // Фильтр по видимости:
  // - Админ/dev видят все игры
  // - Обычные пользователи видят только публичные (hidden !== true)
  if (!isElevatedRole) {
    query.hidden = { $ne: true }
  }

  const queryOffset = toPositiveInteger(offset, 0)
  const queryLimit = toPositiveInteger(limit, 10)
  const fetchLimit = queryLimit + 1

  const gamesDocsRaw = await GamesModel.find(query)
    .sort(resolveGamesSort(view))
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
      descriptionRich: 1,
      descriptionMedia: 1,
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
      registrationOpen: 1,
      maxTeamPlayers: 1,
      prices: 1,
      finances: 1,
      tasks: 1,
      updatedAt: 1,
      createdAt: 1,
      creatorTelegramId: 1,
      moderators: 1,
      location: 1,
      seasonId: 1,
      seasonName: 1,
      'result.computed': 1,
      'result.teamsPlaces': 1,
      'result.teams': 1,
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

  // Фильтровать по view (past/upcoming)
  const now = new Date()
  const gamesFiltered = gamesDocs.filter((game) => {
    if (view === 'all') {
      return true
    }

    const startDate = toDate(game?.dateStart)
    const gameStatus = String(game?.status).trim().toLowerCase()

    if (view === 'upcoming') {
      // Если есть дата и она в будущем -> предстоящая
      if (startDate && startDate >= now) {
        return true
      }
      // Если нет даты или дата в прошлом, но статус активный -> предстоящая
      if (gameStatus === 'active' || gameStatus === 'started') {
        return true
      }
      return false
    }

    if (view === 'past') {
      // Если есть дата и она в прошлом -> прошедшая
      if (startDate && startDate < now) {
        return true
      }
      // Если нет даты или дата в будущем, но статус завершен -> прошедшая
      if (
        gameStatus === 'finished' ||
        gameStatus === 'closed' ||
        gameStatus === 'canceled'
      ) {
        return true
      }
      return false
    }

    return true
  })

  // Загрузить создателей
  const creatorTelegramIds = Array.from(
    new Set(
      gamesFiltered
        .map((game) => Number(game?.creatorTelegramId))
        .filter((value) => Number.isFinite(value)),
    ),
  )

  const creatorsByTelegramId =
    creatorTelegramIds.length > 0
      ? (
          await db
            .model('Users')
            .find({ telegramId: { $in: creatorTelegramIds } })
            .select({ _id: 1, name: 1, username: 1, phone: 1, telegramId: 1 })
            .lean()
        ).reduce((acc, userDoc) => {
          const telegramId = Number(userDoc?.telegramId)
          if (!Number.isFinite(telegramId)) {
            return acc
          }
          acc[String(telegramId)] = {
            _id: userDoc?._id,
            name: typeof userDoc?.name === 'string' ? userDoc.name : '',
            username:
              typeof userDoc?.username === 'string' ? userDoc.username : '',
            phone:
              userDoc?.phone === null || userDoc?.phone === undefined
                ? ''
                : String(userDoc.phone),
            telegramId,
          }
          return acc
        }, {})
      : {}

  const canSeeClosedStatus = userRole === 'admin' || userRole === 'dev'
  const games = gamesFiltered.map((game) => {
    const normalizedStatus =
      game?.status === 'closed' && !canSeeClosedStatus
        ? 'finished'
        : game?.status

    const gameId = game?._id ? game._id.toString() : null
    const creatorTelegramIdNumber = Number(game?.creatorTelegramId)
    const creatorKey = Number.isFinite(creatorTelegramIdNumber)
      ? String(creatorTelegramIdNumber)
      : null

    return normalizeGameForCabinet({
      ...game,
      status: normalizedStatus,
      teamsCount: 0,
      userTeamPlace: null,
      userParticipationTeams: [],
      creator: creatorKey ? (creatorsByTelegramId[creatorKey] ?? null) : null,
    })
  })

  return { games: sortGamesByView(games, view), hasMore }
}

export default fetchGamesForCabinet
