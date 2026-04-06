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

const buildGamesQuery = ({ location, userRole, creatorTelegramId, view }) => {
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
  const TeamsModel = db.model('Teams')
  const UsersModel = db.model('Users')

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
    })
    .populate({
      path: 'moderators',
      select: { _id: 1, name: 1, username: 1, telegramId: 1 },
    })
    .lean()

  const hasMore = gamesDocsRaw.length > queryLimit
  let gamesDocs = gamesDocsRaw.slice(0, queryLimit)

  // Нормализовать ID пользователя для поиска в обоих: текущих командах и исторических снимках
  const currentUserIdString = toStringId(currentUserId)
  const currentUserTelegramIdNumber = Number(currentUserTelegramId)
  const hasUserId = Boolean(currentUserIdString)
  const hasTelegramId = Number.isFinite(currentUserTelegramIdNumber)

  // Поиск дополнительных игр по историческим снимкам участников (result.teamsUsers)
  // Это позволяет найти игры, в которых пользователь участвовал, даже если он вышел из команды
  if ((hasUserId || hasTelegramId) && query) {
    const historyOrConditions = []
    if (hasUserId) {
      historyOrConditions.push({
        'result.teamsUsers.userId': currentUserIdString,
      })
    }
    if (hasTelegramId) {
      historyOrConditions.push({
        'result.teamsUsers.userTelegramId': currentUserTelegramIdNumber,
      })
    }

    if (historyOrConditions.length > 0) {
      const historyQuery = { ...query, $or: historyOrConditions }

      const historicalGamesDocs = await GamesModel.find(historyQuery)
        .sort(resolveGamesSort(view))
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
          'result.teamsUsers': 1,
          'result.teams': 1,
        })
        .populate({
          path: 'moderators',
          select: { _id: 1, name: 1, username: 1, telegramId: 1 },
        })
        .lean()

      // Объединить исходные docs и исторические документы с дедупликацией по _id
      const existingGameIds = new Set(
        gamesDocs.map((g) => g?._id?.toString()).filter(Boolean),
      )
      const additionalDocs = historicalGamesDocs.filter((game) => {
        return !existingGameIds.has(game?._id?.toString())
      })
      gamesDocs = [...gamesDocs, ...additionalDocs]
    }
  }

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
          await UsersModel.find({ telegramId: { $in: creatorTelegramIds } })
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

  // Инициализировать переменные для результатов пользователя
  // (они могут быть заполнены в if/else блоках ниже)
  let userTeamPlaceByGameId = {}
  let userParticipationTeamsByGameId = {}
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

    // Переменные currentUserIdString и currentUserTelegramIdNumber уже определены выше
    if (gamesTeams.length > 0 && (hasUserId || hasTelegramId)) {
      const teamIds = Array.from(
        new Set(
          gamesTeams.map((doc) => toStringId(doc?.teamId)).filter(Boolean),
        ),
      )

      const membershipOr = []
      if (hasUserId) {
        membershipOr.push({ userId: currentUserIdString })
      }
      if (hasTelegramId) {
        membershipOr.push({ userTelegramId: currentUserTelegramIdNumber })
      }

      const memberships =
        teamIds.length && membershipOr.length
          ? await TeamsUsersModel.find({
              teamId: { $in: teamIds },
              $or: membershipOr,
            })
              .select({ teamId: 1, role: 1 })
              .lean()
          : []

      const userMembershipByTeamId = memberships.reduce((acc, doc) => {
        const teamId = toStringId(doc?.teamId)
        if (!teamId) {
          return acc
        }

        const role =
          typeof doc?.role === 'string' ? doc.role.trim().toLowerCase() : ''
        acc[teamId] = {
          teamId,
          isCaptain: role === 'capitan',
        }
        return acc
      }, {})

      const userTeamIdsSet = new Set(Object.keys(userMembershipByTeamId))
      const teamsById = teamIds.length
        ? (
            await TeamsModel.find({ _id: { $in: teamIds } })
              .select({ _id: 1, name: 1 })
              .lean()
          ).reduce((acc, teamDoc) => {
            const teamId = toStringId(teamDoc?._id)
            if (!teamId) {
              return acc
            }
            acc[teamId] = teamDoc
            return acc
          }, {})
        : {}

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

      userParticipationTeamsByGameId = Object.entries(
        userTeamIdsByGameId,
      ).reduce((acc, [gameId, ids]) => {
        const uniqueTeamIds = Array.from(new Set(Array.isArray(ids) ? ids : []))
        if (uniqueTeamIds.length === 0) {
          return acc
        }

        acc[gameId] = uniqueTeamIds.map((teamId) => {
          const membership = userMembershipByTeamId[teamId] ?? {
            teamId,
            isCaptain: false,
          }
          const teamDoc = teamsById[teamId]

          return {
            teamId,
            teamName:
              typeof teamDoc?.name === 'string' && teamDoc.name.trim() !== ''
                ? teamDoc.name.trim()
                : `Команда ${teamId}`,
            isCaptain: Boolean(membership?.isCaptain),
          }
        })

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

      // Дополнить результаты данными из исторических снимков (result.teamsUsers)
      // для игр, в которых пользователь участвовал, но больше не находится в той команде
      gamesFiltered.forEach((game) => {
        const gameId = toStringId(game?._id)
        if (!gameId || userTeamPlaceByGameId[gameId] !== undefined) {
          // Игра уже обработана или доступна через текущие членства
          return
        }

        // Поиск пользователя в исторических снимках участников
        const resultTeamsUsers = Array.isArray(game?.result?.teamsUsers)
          ? game.result.teamsUsers
          : []
        const userTeamsFromSnapshot = resultTeamsUsers.filter((tu) => {
          const matchesUserId =
            currentUserIdString &&
            toStringId(tu?.userId) === currentUserIdString
          const matchesTelegramId =
            Number.isFinite(currentUserTelegramIdNumber) &&
            Number(tu?.userTelegramId) === currentUserTelegramIdNumber
          return matchesUserId || matchesTelegramId
        })

        if (userTeamsFromSnapshot.length === 0) {
          return
        }

        // Получить данные из snapshot: места команд и названия команд
        const snapshotTeamIds = userTeamsFromSnapshot
          .map((tu) => toStringId(tu?.teamId))
          .filter(Boolean)

        const resultTeams = Array.isArray(game?.result?.teams)
          ? game.result.teams
          : []
        const resultTeamsById = resultTeams.reduce((acc, team) => {
          const teamId = toStringId(team?.id)
          if (teamId) {
            acc[teamId] = team
          }
          return acc
        }, {})

        // Найти места команд
        const places = snapshotTeamIds
          .map((teamId) => resolveTeamsPlace(game?.result?.teamsPlaces, teamId))
          .filter((place) => Number.isFinite(place))
          .map(Number)

        if (places.length > 0) {
          userTeamPlaceByGameId[gameId] = Math.min(...places)
        } else if (snapshotTeamIds.length > 0) {
          // Если нет teamsPlaces, но есть команды в snapshot, установить дефолтное место
          // Это может произойти для старых игр без пересчета результата
          // Установим место равное количеству команд в результате (worst case scenario)
          const resultTeamsCount = Array.isArray(game?.result?.teams)
            ? game.result.teams.length
            : null
          if (Number.isFinite(resultTeamsCount)) {
            userTeamPlaceByGameId[gameId] = resultTeamsCount
          } else {
            // Если даже это не известно, установить минимальное место
            userTeamPlaceByGameId[gameId] = 1
          }
        }

        // Добавить команды в userParticipationTeamsByGameId
        userParticipationTeamsByGameId[gameId] = userTeamsFromSnapshot.map(
          (tu) => {
            const teamId = toStringId(tu?.teamId)
            const snapshotTeam = teamId ? resultTeamsById[teamId] : null
            const teamName =
              snapshotTeam &&
              typeof snapshotTeam?.name === 'string' &&
              snapshotTeam.name.trim()
                ? snapshotTeam.name.trim()
                : teamId
                  ? `Команда ${teamId}`
                  : 'Неизвестная команда'

            return {
              teamId,
              teamName,
              isCaptain: tu?.role === 'capitan',
            }
          },
        )
      })
    } else if (
      currentUserIdString ||
      Number.isFinite(currentUserTelegramIdNumber)
    ) {
      // Если нет текущих членств через GamesTeams, но есть ID пользователя,
      // попробовать найти игры через исторические снимки
      // Используем уже инициализованные переменные userTeamPlaceByGameId и userParticipationTeamsByGameId

      gamesFiltered.forEach((game) => {
        const gameId = toStringId(game?._id)
        if (!gameId) {
          return
        }

        const resultTeamsUsers = Array.isArray(game?.result?.teamsUsers)
          ? game.result.teamsUsers
          : []
        const userTeamsFromSnapshot = resultTeamsUsers.filter((tu) => {
          const matchesUserId =
            currentUserIdString &&
            toStringId(tu?.userId) === currentUserIdString
          const matchesTelegramId =
            Number.isFinite(currentUserTelegramIdNumber) &&
            Number(tu?.userTelegramId) === currentUserTelegramIdNumber
          return matchesUserId || matchesTelegramId
        })

        if (userTeamsFromSnapshot.length === 0) {
          return
        }

        const resultTeams = Array.isArray(game?.result?.teams)
          ? game.result.teams
          : []
        const resultTeamsById = resultTeams.reduce((acc, team) => {
          const teamId = toStringId(team?.id)
          if (teamId) {
            acc[teamId] = team
          }
          return acc
        }, {})

        const snapshotTeamIds = userTeamsFromSnapshot
          .map((tu) => toStringId(tu?.teamId))
          .filter(Boolean)

        const places = snapshotTeamIds
          .map((teamId) => resolveTeamsPlace(game?.result?.teamsPlaces, teamId))
          .filter((place) => Number.isFinite(place))
          .map(Number)

        if (places.length > 0) {
          userTeamPlaceByGameId[gameId] = Math.min(...places)
        } else if (snapshotTeamIds.length > 0) {
          // Если нет teamsPlaces, но есть команды в snapshot, установить дефолтное место
          // Это может произойти для старых игр без пересчета результата
          // Установим место равное количеству команд в результате (worst case scenario)
          const resultTeamsCount = Array.isArray(game?.result?.teams)
            ? game.result.teams.length
            : null
          if (Number.isFinite(resultTeamsCount)) {
            userTeamPlaceByGameId[gameId] = resultTeamsCount
          } else {
            // Если даже это не известно, установить минимальное место
            userTeamPlaceByGameId[gameId] = 1
          }
        }

        userParticipationTeamsByGameId[gameId] = userTeamsFromSnapshot.map(
          (tu) => {
            const teamId = toStringId(tu?.teamId)
            const snapshotTeam = teamId ? resultTeamsById[teamId] : null
            const teamName =
              snapshotTeam &&
              typeof snapshotTeam?.name === 'string' &&
              snapshotTeam.name.trim()
                ? snapshotTeam.name.trim()
                : teamId
                  ? `Команда ${teamId}`
                  : 'Неизвестная команда'

            return {
              teamId,
              teamName,
              isCaptain: tu?.role === 'capitan',
            }
          },
        )
      })
    }
    // Используемые переменные объявлены и заполнены выше (userTeamPlaceByGameId, userParticipationTeamsByGameId)

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
        teamsCount: gameId ? (teamsCountMap[gameId] ?? 0) : 0,
        userTeamPlace: gameId ? (userTeamPlaceByGameId[gameId] ?? null) : null,
        userParticipationTeams: gameId
          ? (userParticipationTeamsByGameId[gameId] ?? [])
          : [],
        creator: creatorKey ? (creatorsByTelegramId[creatorKey] ?? null) : null,
      })
    })

    return { games: sortGamesByView(games, view), hasMore }
  }

  const games = gamesFiltered.map((game) => {
    const normalizedStatus =
      game?.status === 'closed' && !canSeeClosedStatus
        ? 'finished'
        : game?.status

    return normalizeGameForCabinet({
      ...game,
      status: normalizedStatus,
      teamsCount: game?._id ? (teamsCountMap[game._id.toString()] ?? 0) : 0,
      userTeamPlace: null,
      userParticipationTeams: [],
    })
  })

  return { games: sortGamesByView(games, view), hasMore }
}

export default fetchGamesForCabinet
