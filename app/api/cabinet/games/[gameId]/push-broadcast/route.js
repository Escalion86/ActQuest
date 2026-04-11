import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import dbConnectGlobal from '@utils/dbConnectGlobal'
import { broadcastNotificationToUsers } from '@server/pwaNotifications'
import { toStringId } from '@helpers/idAndDate'

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

const isGameStarted = (status) =>
  String(status || '')
    .trim()
    .toLowerCase() === 'started'

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

const normalizeLocationKey = (value) => {
  if (typeof value !== 'string') {
    return ''
  }

  return value.trim().toLowerCase()
}

const isManagerOfGame = ({ sessionUser, game }) => {
  if (!sessionUser || !game) {
    return false
  }

  const role = normalizeRole(sessionUser.role) || 'client'
  if (role === 'admin' || role === 'dev') {
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

  const sessionUserId = toStringId(sessionUser._id)
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

  const uniqueUsersByTelegramId = new Map()
  users.forEach((user) => {
    const telegramId = Number(user?.telegramId)
    if (!Number.isFinite(telegramId)) {
      return
    }

    uniqueUsersByTelegramId.set(telegramId, user)
  })

  return Array.from(uniqueUsersByTelegramId.values())
}

const getAllUsersForBroadcast = async ({ db, gameLocation }) => {
  const Users = db.model('Users')
  const normalizedGameLocation = normalizeLocationKey(gameLocation)
  const users = await Users.find({})
    .select({
      _id: 1,
      telegramId: 1,
      pushSubscriptions: 1,
      currentLocation: 1,
      accountLocation: 1,
    })
    .lean()

  return users.filter((user) => {
    if (!Number.isFinite(Number(user?.telegramId))) {
      return false
    }

    const userParticipationLocation = normalizeLocationKey(
      user?.currentLocation || user?.accountLocation || '',
    )

    return (
      normalizedGameLocation.length > 0 &&
      userParticipationLocation === normalizedGameLocation
    )
  })
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

  if (!isAnnouncementForAll && !isCustomForRegistered) {
    return NextResponse.json(
      {
        success: false,
        error: 'Некорректный режим рассылки',
      },
      { status: 400 },
    )
  }

  const customMessage = sanitizeCustomMessage(body?.message)
  if (isCustomForRegistered && customMessage.length === 0) {
    return NextResponse.json(
      {
        success: false,
        error: 'Введите сообщение для отправки зарегистрированным командам',
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

    if (isGameStarted(game.status)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Во время процесса игры рассылка через карточку игры недоступна',
        },
        { status: 409 },
      )
    }

    if (
      isAnnouncementForAll &&
      normalizeLocationKey(game?.location).length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            'У игры не указан город проведения. Невозможно отправить анонс по городу.',
        },
        { status: 400 },
      )
    }

    const users = isAnnouncementForAll
      ? await getAllUsersForBroadcast({ db, gameLocation: game.location })
      : await getUsersForGameRegistrations({ db, gameId })

    const gameName =
      typeof game?.name === 'string' && game.name.trim()
        ? game.name.trim()
        : 'Без названия'
    const notification = {
      title: isAnnouncementForAll
        ? `Анонс игры «${gameName}»`
        : `Сообщение по игре «${gameName}»`,
      body: isAnnouncementForAll ? formatAnnouncementBody(game) : customMessage,
      tag: `game-${gameId}-${isAnnouncementForAll ? 'announce' : 'custom'}`,
      data: {
        type: isAnnouncementForAll ? 'game_announcement' : 'game_custom_message',
        gameId,
        gameName,
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
