import {
  canViewCabinetGameRestrictedInfo,
  sanitizeCabinetGameForViewer,
} from '@helpers/cabinetGameVisibility'
import normalizeGameForCabinet from '@helpers/normalizeGameForCabinet'
import { toStringId } from '@helpers/idAndDate'
import { isCaptainRole } from '@helpers/teamRoles'

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

const normalizeTelegramId = (value) => {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null
  }

  return numeric
}

const isObjectIdLike = (value) =>
  typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value.trim())

const resolveGamesSort = (view) => {
  if (view === 'upcoming') {
    return { dateStart: 1, _id: 1 }
  }
  if (view === 'past') {
    return { dateStartFact: -1, dateStart: -1, _id: 1 }
  }
  return { updatedAt: -1, _id: 1 }
}

const resolvePastGameSortDate = (game) =>
  toDate(game?.dateStartFact) ||
  toDate(game?.dateStart) ||
  toDate(game?.dateEndFact)

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
      const firstDate = resolvePastGameSortDate(first)
      const secondDate = resolvePastGameSortDate(second)
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

const fetchGamesForCabinet = async ({
  db,
  location,
  userRole,
  currentUserId = null,
  offset = 0,
  limit = 10,
  view = 'all',
}) => {
  if (!db) {
    return { games: [], hasMore: false }
  }

  const GamesModel = db.model('Games')

  const currentUserIdString = toStringId(currentUserId)
  const hasUserId = Boolean(currentUserIdString)
  const isElevatedRole = userRole === 'admin' || userRole === 'dev'

  // Построить базовый query
  const query = {}

  // Фильтр по location
  const normalizedLocation =
    typeof location === 'string' ? location.trim().toLowerCase() : null
  if (normalizedLocation) {
    query.location = normalizedLocation
  }

  // Загрузить команды текущего пользователя (для participation и видимости скрытых игр)
  let userTeamIds = []
  let userTeamRoles = {} // teamId -> role

  if (hasUserId) {
    const TeamsUsersModel = db.model('TeamsUsers')
    const userTeamsDocs = await TeamsUsersModel.find({
      userId: currentUserIdString,
    })
      .select({ teamId: 1, role: 1 })
      .lean()

    userTeamIds = userTeamsDocs
      .map((t) => toStringId(t?.teamId))
      .filter(Boolean)

    for (const tu of userTeamsDocs) {
      const tId = toStringId(tu?.teamId)
      if (tId) {
        userTeamRoles[tId] =
          typeof tu?.role === 'string' ? tu.role : 'participant'
      }
    }
  }

  // Фильтр по видимости:
  // - Админ/dev видят все игры
  // - Обычные пользователи видят публичные + скрытые, на которые записана их команда
  if (!isElevatedRole) {
    let hiddenGameIds = []

    if (userTeamIds.length > 0) {
      const GamesTeamsModelVis = db.model('GamesTeams')

      const userGamesTeamsDocs = await GamesTeamsModelVis.find({
        teamId: { $in: userTeamIds },
      })
        .select({ gameId: 1 })
        .lean()

      hiddenGameIds = Array.from(
        new Set(
          userGamesTeamsDocs
            .map((gt) => toStringId(gt?.gameId))
            .filter(Boolean),
        ),
      )
    }

    if (hiddenGameIds.length > 0) {
      query.$and = [
        {
          $or: [{ hidden: { $ne: true } }, { _id: { $in: hiddenGameIds } }],
        },
      ]
    } else {
      query.hidden = { $ne: true }
    }
  }

  // Фильтр по view - добавляем в query для правильной пагинации
  const now = new Date()
  if (view === 'upcoming') {
    const viewFilter = {
      $or: [
        { dateStart: { $gte: now } },
        { status: { $in: ['active', 'started'] } },
      ],
    }
    if (query.$and) {
      query.$and.push(viewFilter)
    } else {
      query.$or = viewFilter.$or
    }
  } else if (view === 'past') {
    const viewFilter = {
      $or: [
        { dateStart: { $lt: now } },
        { status: { $in: ['finished', 'closed', 'canceled'] } },
      ],
    }
    if (query.$and) {
      query.$and.push(viewFilter)
    } else {
      query.$or = viewFilter.$or
    }
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
      prequel: 1,
      image: 1,
      startingPlace: 1,
      finishingPlace: 1,
      showFinishingPlace: 1,
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
      showEnterButton: 1,
      showTasks: 1,
      hideResult: 1,
      registrationOpen: 1,
      maxTeamPlayers: 1,
      prices: 1,
      finances: 1,
      tasks: 1,
      updatedAt: 1,
      createdAt: 1,
      creatorUserId: 1,
      creatorTelegramId: 1,
      moderators: 1,
      agents: 1,
      agentNotifications: 1,
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

  const loadedGameIds = gamesDocs.map((g) => toStringId(g?._id)).filter(Boolean)

  // Загрузить количество команд для предстоящих игр из GamesTeams
  const GamesTeamsModel = db.model('GamesTeams')
  const upcomingGameIds = gamesDocs
    .filter((g) => {
      const s = String(g?.status).toLowerCase()
      return s === 'active' || s === 'started' || s === 'canceled'
    })
    .map((g) => toStringId(g?._id))
    .filter(Boolean)

  const teamsCountByGameId = {}
  const adminUnreadMessagesCountByGameId = {}

  if (loadedGameIds.length > 0) {
    const unreadMessageRows = await db
      .model('GameTeamMessages')
      .aggregate([
        {
          $match: {
            gameId: { $in: loadedGameIds },
            direction: 'team_to_admin',
            readByAdminAt: null,
          },
        },
        {
          $group: {
            _id: '$gameId',
            count: { $sum: 1 },
          },
        },
      ])

    for (const row of unreadMessageRows) {
      const gameId = toStringId(row?._id)
      if (gameId) {
        adminUnreadMessagesCountByGameId[gameId] = Number(row?.count || 0)
      }
    }
  }

  if (upcomingGameIds.length > 0) {
    const gamesTeamsDocs = await GamesTeamsModel.find({
      gameId: { $in: upcomingGameIds },
    })
      .select({ gameId: 1 })
      .lean()

    for (const gt of gamesTeamsDocs) {
      const gId = toStringId(gt?.gameId)
      if (gId) {
        teamsCountByGameId[gId] = (teamsCountByGameId[gId] || 0) + 1
      }
    }
  }

  // Загрузить создателей. Новый источник — creatorUserId, telegramId оставлен
  // fallback для исторических игр.
  const creatorUserIds = Array.from(
    new Set(
      gamesDocs
        .map((game) => toStringId(game?.creatorUserId))
        .filter(isObjectIdLike),
    ),
  )
  const creatorTelegramIds = Array.from(
    new Set(
      gamesDocs
        .map((game) => normalizeTelegramId(game?.creatorTelegramId))
        .filter((value) => value !== null),
    ),
  )

  const creatorsByUserId =
    creatorUserIds.length > 0
      ? (
          await db
            .model('Users')
            .find({ _id: { $in: creatorUserIds } })
            .select({ _id: 1, name: 1, username: 1, phone: 1, telegramId: 1 })
            .lean()
        ).reduce((acc, userDoc) => {
          const userId = toStringId(userDoc?._id)
          if (!userId) {
            return acc
          }
          acc[userId] = {
            _id: userDoc?._id,
            name: typeof userDoc?.name === 'string' ? userDoc.name : '',
            username:
              typeof userDoc?.username === 'string' ? userDoc.username : '',
            phone:
              userDoc?.phone === null || userDoc?.phone === undefined
                ? ''
                : String(userDoc.phone),
            telegramId: normalizeTelegramId(userDoc?.telegramId),
          }
          return acc
        }, {})
      : {}

  const creatorsByTelegramId =
    creatorTelegramIds.length > 0
      ? (
          await db
            .model('Users')
            .find({ telegramId: { $in: creatorTelegramIds } })
            .select({ _id: 1, name: 1, username: 1, phone: 1, telegramId: 1 })
            .lean()
        ).reduce((acc, userDoc) => {
          const telegramId = normalizeTelegramId(userDoc?.telegramId)
          if (telegramId === null) {
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

  const agentUserIds = Array.from(
    new Set(
      gamesDocs
        .flatMap((game) => (Array.isArray(game?.agents) ? game.agents : []))
        .map((agent) => toStringId(agent?.userId))
        .filter(isObjectIdLike),
    ),
  )
  const agentsByUserId =
    agentUserIds.length > 0
      ? (
          await db
            .model('Users')
            .find({ _id: { $in: agentUserIds } })
            .select({ _id: 1, name: 1, username: 1, telegramId: 1 })
            .lean()
        ).reduce((acc, userDoc) => {
          const userId = toStringId(userDoc?._id)
          if (!userId) {
            return acc
          }
          acc[userId] = {
            _id: userDoc?._id,
            name: typeof userDoc?.name === 'string' ? userDoc.name : '',
            username:
              typeof userDoc?.username === 'string' ? userDoc.username : '',
            telegramId: normalizeTelegramId(userDoc?.telegramId),
          }
          return acc
        }, {})
      : {}

  const canSeeClosedStatus = userRole === 'admin' || userRole === 'dev'

  // Загрузить participation пользователя для каждой загруженной игры
  const participationByGameId = {} // gameId -> [{ teamId, teamName, isCaptain }]

  if (userTeamIds.length > 0) {
    const allGameIds = gamesDocs.map((g) => toStringId(g?._id)).filter(Boolean)

    if (allGameIds.length > 0) {
      const userGamesTeamsDocs = await GamesTeamsModel.find({
        gameId: { $in: allGameIds },
        teamId: { $in: userTeamIds },
      })
        .select({ _id: 1, gameId: 1, teamId: 1, prequelProgress: 1 })
        .lean()

      // Собрать уникальные teamId для загрузки имён
      const participatingTeamIds = Array.from(
        new Set(
          userGamesTeamsDocs
            .map((gt) => toStringId(gt?.teamId))
            .filter(Boolean),
        ),
      )

      const teamsNamesById = {}
      if (participatingTeamIds.length > 0) {
        const TeamsModel = db.model('Teams')
        const teamsDocs = await TeamsModel.find({
          _id: { $in: participatingTeamIds },
        })
          .select({ _id: 1, name: 1 })
          .lean()

        for (const t of teamsDocs) {
          teamsNamesById[toStringId(t._id)] =
            typeof t?.name === 'string' ? t.name : ''
        }
      }

      for (const gt of userGamesTeamsDocs) {
        const gId = toStringId(gt?.gameId)
        const tId = toStringId(gt?.teamId)
        if (!gId || !tId) {
          continue
        }
        if (!participationByGameId[gId]) {
          participationByGameId[gId] = []
        }
        const role = userTeamRoles[tId] || 'participant'
        participationByGameId[gId].push({
          teamId: tId,
          gameTeamId: toStringId(gt?._id),
          teamName: teamsNamesById[tId] || '',
          isCaptain: isCaptainRole(role),
          prequelProgress: gt?.prequelProgress || null,
        })
      }
    }
  }

  const games = gamesDocs.map((game) => {
    const normalizedStatus =
      game?.status === 'closed' && !canSeeClosedStatus
        ? 'finished'
        : game?.status

    const gameId = game?._id ? game._id.toString() : null
    const gameStatus = String(game?.status).toLowerCase()
    const creatorTelegramIdNumber = normalizeTelegramId(game?.creatorTelegramId)
    const creatorUserId = toStringId(game?.creatorUserId)
    const creatorKey = creatorTelegramIdNumber !== null
      ? String(creatorTelegramIdNumber)
      : null

    // Для finished/closed — из result.teams, для остальных — из GamesTeams
    const teamsCount =
      gameStatus === 'finished' || gameStatus === 'closed'
        ? Array.isArray(game?.result?.teams)
          ? game.result.teams.length
          : 0
        : gameId
          ? teamsCountByGameId[gameId] || 0
          : 0

    return normalizeGameForCabinet({
      ...sanitizeCabinetGameForViewer(game, {
        canViewRestrictedGameInfo: canViewCabinetGameRestrictedInfo({
          userRole,
          currentUserId: currentUserIdString,
          gameCreatorUserId: creatorUserId,
          isGameModerator: (Array.isArray(game?.moderators) ? game.moderators : [])
            .some(
              (moderator) =>
                toStringId(moderator?._id ?? moderator?.id ?? moderator) ===
                currentUserIdString,
            ),
        }),
      }),
      status: normalizedStatus,
      teamsCount,
      adminUnreadMessagesCount: gameId
        ? adminUnreadMessagesCountByGameId[gameId] || 0
        : 0,
      userTeamPlace: null,
      userParticipationTeams: gameId ? participationByGameId[gameId] || [] : [],
      agents: (Array.isArray(game?.agents) ? game.agents : []).map((agent) => {
        const userId = toStringId(agent?.userId)
        const user = userId ? agentsByUserId[userId] : null
        return {
          userId,
          active: agent?.active !== false,
          name: user?.name || '',
          username: user?.username || '',
          telegramId: user?.telegramId || '',
        }
      }),
      creator:
        (creatorUserId ? creatorsByUserId[creatorUserId] : null) ??
        (creatorKey ? creatorsByTelegramId[creatorKey] : null) ??
        null,
    })
  })

  return { games: sortGamesByView(games, view), hasMore }
}

export default fetchGamesForCabinet
