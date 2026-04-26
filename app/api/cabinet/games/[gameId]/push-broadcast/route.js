import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import dbConnectGlobal from '@utils/dbConnectGlobal'
import { broadcastNotificationToUsers } from '@server/pwaNotifications'
import { toStringId } from '@helpers/idAndDate'
import resolveUserCityKey from '@helpers/resolveUserCityKey'

const normalizeRole = (value) => {
  if (typeof value !== 'string') {
    return null
  }

  const normalizedRaw = value.trim().toLowerCase()
  const normalized = normalizedRaw
  return ['client', 'moder', 'admin', 'dev'].includes(normalized)
    ? normalized
    : null
}

const formatAnnouncementBody = (game) => {
  const gameName =
    typeof game?.name === 'string' && game.name.trim()
      ? game.name.trim()
      : 'Без названия'
  const startDateRaw = game?.dateStart ? new Date(game.dateStart) : null
  const hasStartDate =
    startDateRaw instanceof Date && !Number.isNaN(startDateRaw.getTime())
  const startDateLabel = hasStartDate
    ? startDateRaw.toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null

  if (startDateLabel) {
    return `Открыт анонс игры «${gameName}». Плановый старт: ${startDateLabel}. Подробности доступны в кабинете.`
  }

  return `Открыт анонс игры «${gameName}». Подробности доступны в кабинете.`
}

const sanitizeCustomMessage = (value) => {
  if (typeof value !== 'string') {
    return ''
  }

  return value.trim()
}

const dedupeUsers = (users) => {
  const map = new Map()
  ;(Array.isArray(users) ? users : []).forEach((user) => {
    if (!user || typeof user !== 'object') return
    const idKey = toStringId(user?._id)
    const tgKey =
      Number.isFinite(Number(user?.telegramId)) ? `tg:${Number(user.telegramId)}` : ''
    const fallbackKey =
      typeof user?.phone === 'number' && Number.isFinite(user.phone)
        ? `ph:${String(user.phone)}`
        : ''
    const key = idKey || tgKey || fallbackKey
    if (!key) return
    if (!map.has(key)) {
      map.set(key, user)
    }
  })
  return Array.from(map.values())
}

const isManagerOfGame = ({ sessionUser, game }) => {
  if (!sessionUser || !game) {
    return false
  }

  const role = normalizeRole(sessionUser.role) || 'client'
  if (role === 'admin' || role === 'dev') {
    return true
  }

  const sessionUserId = toStringId(
    sessionUser.globalUserId ??
      sessionUser.userId ??
      sessionUser._id ??
      sessionUser.id,
  )
  const gameCreatorUserId = toStringId(game.creatorUserId)
  if (sessionUserId && gameCreatorUserId && sessionUserId === gameCreatorUserId) {
    return true
  }

  const sessionTelegramId = toStringId(sessionUser.telegramId)
  const gameCreatorTelegramId = toStringId(game.creatorTelegramId)
  if (
    sessionTelegramId &&
    gameCreatorTelegramId &&
    sessionTelegramId === gameCreatorTelegramId
  ) {
    return true
  }

  if (!sessionUserId) {
    return false
  }

  const moderators = Array.isArray(game.moderators) ? game.moderators : []
  return moderators.some((moderator) => {
    if (!moderator) {
      return false
    }

    if (typeof moderator === 'string') {
      return toStringId(moderator) === sessionUserId
    }

    return toStringId(moderator?._id ?? moderator?.id) === sessionUserId
  })
}

const getUsersForGameRegistrations = async ({ db, gameId }) => {
  const GamesTeams = db.model('GamesTeams')
  const TeamsUsers = db.model('TeamsUsers')
  const Users = db.model('Users')

  const gameTeams = await GamesTeams.find({ gameId }).select({ teamId: 1 }).lean()

  const teamIds = Array.from(
    new Set(gameTeams.map((item) => toStringId(item?.teamId)).filter(Boolean)),
  )

  if (teamIds.length === 0) {
    return []
  }

  const teamMemberships = await TeamsUsers.find({ teamId: { $in: teamIds } })
    .select({ userId: 1 })
    .lean()

  const userIds = Array.from(
    new Set(teamMemberships.map((item) => toStringId(item?.userId)).filter(Boolean)),
  )
  const objectIdUserIds = userIds.filter((value) => /^[0-9a-fA-F]{24}$/.test(value))
  if (objectIdUserIds.length === 0) {
    return []
  }

  const users = await Users.find({
    _id: { $in: objectIdUserIds },
  })
    .select({ _id: 1, telegramId: 1, pushSubscriptions: 1 })
    .lean()

  return dedupeUsers(users)
}

const getUsersForSingleGameTeam = async ({ db, gameId, teamId }) => {
  const GamesTeams = db.model('GamesTeams')
  const TeamsUsers = db.model('TeamsUsers')
  const Users = db.model('Users')
  const teamIdAsString = toStringId(teamId)

  if (!teamIdAsString) {
    return { users: [], teamFound: false }
  }

  const gameTeams = await GamesTeams.find({ gameId }).select({ teamId: 1 }).lean()
  const matchingGameTeam = gameTeams.find(
    (item) => toStringId(item?.teamId) === teamIdAsString,
  )
  if (!matchingGameTeam) {
    return { users: [], teamFound: false }
  }

  const rawTeamId = matchingGameTeam.teamId
  const teamMemberships = await TeamsUsers.find({ teamId: rawTeamId })
    .select({ userId: 1 })
    .lean()

  const userIds = Array.from(
    new Set(teamMemberships.map((item) => toStringId(item?.userId)).filter(Boolean)),
  )
  const objectIdUserIds = userIds.filter((value) => /^[0-9a-fA-F]{24}$/.test(value))
  if (objectIdUserIds.length === 0) {
    return { users: [], teamFound: true, resolvedTeamId: toStringId(rawTeamId) }
  }

  const users = await Users.find({
    _id: { $in: objectIdUserIds },
  })
    .select({ _id: 1, telegramId: 1, pushSubscriptions: 1 })
    .lean()

  return {
    users: dedupeUsers(users),
    teamFound: true,
    resolvedTeamId: toStringId(rawTeamId),
  }
}

const getAllUsersForBroadcast = async ({ db, gameLocation }) => {
  const Users = db.model('Users')
  const normalizedGameLocation = resolveUserCityKey(
    { currentLocation: gameLocation },
    null,
  )
  const users = await Users.find({})
    .select({
      _id: 1,
      telegramId: 1,
      pushSubscriptions: 1,
      currentLocation: 1,
      accountLocation: 1,
    })
    .lean()

  return dedupeUsers(users.filter((user) => {
    const userParticipationLocation = resolveUserCityKey(user, null)
    return (
      Boolean(normalizedGameLocation) &&
      userParticipationLocation === normalizedGameLocation
    )
  }))
}

export async function POST(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: 'Требуется авторизация' },
      { status: 401 },
    )
  }

  const resolvedParams = await params
  const gameId = toStringId(resolvedParams?.gameId)
  if (!gameId) {
    return NextResponse.json(
      { success: false, error: 'Не передан идентификатор игры' },
      { status: 400 },
    )
  }

  const body = await request.json().catch(() => ({}))
  const mode = typeof body?.mode === 'string' ? body.mode.trim() : ''
  const isAnnouncementForAll = mode === 'announce_all_users'
  const isCustomForRegistered = mode === 'custom_for_registered'
  const isCustomForTeam = mode === 'custom_for_team'

  if (!isAnnouncementForAll && !isCustomForRegistered && !isCustomForTeam) {
    return NextResponse.json(
      {
        success: false,
        error: 'Некорректный режим рассылки',
      },
      { status: 400 },
    )
  }

  const customMessage = sanitizeCustomMessage(body?.message)
  if ((isCustomForRegistered || isCustomForTeam) && customMessage.length === 0) {
    return NextResponse.json(
      {
        success: false,
        error: 'Введите сообщение для отправки',
      },
      { status: 400 },
    )
  }

  if (customMessage.length > 1200) {
    return NextResponse.json(
      {
        success: false,
        error: 'Сообщение слишком длинное. Максимум 1200 символов.',
      },
      { status: 400 },
    )
  }

  const requestedTeamId = isCustomForTeam ? toStringId(body?.teamId) : ''
  if (isCustomForTeam && !requestedTeamId) {
    return NextResponse.json(
      { success: false, error: 'Не передан идентификатор команды' },
      { status: 400 },
    )
  }

  try {
    const db = await dbConnectGlobal()
    if (!db) {
      return NextResponse.json(
        { success: false, error: 'База данных недоступна' },
        { status: 503 },
      )
    }

    const game = await db
      .model('Games')
      .findById(gameId)
      .select({
        _id: 1,
        name: 1,
        dateStart: 1,
        status: 1,
        location: 1,
        creatorUserId: 1,
        creatorTelegramId: 1,
        moderators: 1,
      })
      .lean()

    if (!game) {
      return NextResponse.json(
        { success: false, error: 'Игра не найдена' },
        { status: 404 },
      )
    }

    if (!isManagerOfGame({ sessionUser: session.user, game })) {
      return NextResponse.json(
        { success: false, error: 'Недостаточно прав для рассылки по этой игре' },
        { status: 403 },
      )
    }

    if (isAnnouncementForAll && !resolveUserCityKey({ currentLocation: game?.location }, null)) {
      return NextResponse.json(
        {
          success: false,
          error:
            'У игры не указан город проведения. Невозможно отправить анонс по городу.',
        },
        { status: 400 },
      )
    }

    let users = []
    let resolvedTeamId = ''
    if (isAnnouncementForAll) {
      users = await getAllUsersForBroadcast({ db, gameLocation: game.location })
    } else if (isCustomForRegistered) {
      users = await getUsersForGameRegistrations({ db, gameId })
    } else {
      const teamResult = await getUsersForSingleGameTeam({
        db,
        gameId,
        teamId: requestedTeamId,
      })
      if (!teamResult.teamFound) {
        return NextResponse.json(
          { success: false, error: 'Команда не найдена среди зарегистрированных на игру' },
          { status: 404 },
        )
      }
      users = teamResult.users
      resolvedTeamId = teamResult.resolvedTeamId || requestedTeamId
    }

    const gameName =
      typeof game?.name === 'string' && game.name.trim()
        ? game.name.trim()
        : 'Без названия'
    let teamName = ''
    if (isCustomForTeam && resolvedTeamId) {
      try {
        const teamDoc = await db.model('Teams').findById(resolvedTeamId).select({ name: 1 }).lean()
        teamName =
          typeof teamDoc?.name === 'string' && teamDoc.name.trim()
            ? teamDoc.name.trim()
            : ''
      } catch {
        teamName = ''
      }
    }
    const notification = {
      title: isAnnouncementForAll
        ? `Анонс игры «${gameName}»`
        : isCustomForTeam
          ? `Сообщение команде${teamName ? ` «${teamName}»` : ''}`
          : `Сообщение по игре «${gameName}»`,
      body: isAnnouncementForAll ? formatAnnouncementBody(game) : customMessage,
      tag: `game-${gameId}-${isAnnouncementForAll ? 'announce' : isCustomForTeam ? `team-${resolvedTeamId || requestedTeamId}` : 'custom'}`,
      data: {
        type: isAnnouncementForAll
          ? 'game_announcement'
          : isCustomForTeam
            ? 'game_team_custom_message'
            : 'game_custom_message',
        gameId,
        gameName,
        ...(isCustomForTeam ? { teamId: resolvedTeamId || requestedTeamId } : {}),
        location: typeof game.location === 'string' ? game.location : 'global',
        url: '/cabinet/games-upcoming',
      },
      location: typeof game.location === 'string' ? game.location : 'global',
    }

    const result = await broadcastNotificationToUsers({
      db,
      users,
      notification,
    })

    return NextResponse.json(
      {
        success: true,
        data: {
          mode,
          gameId,
          ...(isCustomForTeam ? { teamId: resolvedTeamId || requestedTeamId } : {}),
          usersMatched: users.length,
          notificationsCreated: result?.created || 0,
          pushDelivered: result?.delivered || 0,
          invalidSubscriptionsRemoved: result?.removed || 0,
        },
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('Failed to broadcast game push notification (app)', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Не удалось отправить push-уведомления',
      },
      { status: 500 },
    )
  }
}
