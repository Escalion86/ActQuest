import { getServerSession } from 'next-auth/next'

import { authOptions } from '@pages/api/auth/[...nextauth]'
import dbConnectGlobal from '@utils/dbConnectGlobal'
import { broadcastNotificationToUsers } from '@server/pwaNotifications'

const normalizeRole = (value) => {
  if (typeof value !== 'string') {
    return null
  }

  const normalizedRaw = value.trim().toLowerCase()
  const normalized = normalizedRaw === 'moderator' ? 'moder' : normalizedRaw
  return ['client', 'moder', 'admin', 'dev'].includes(normalized)
    ? normalized
    : null
}

const toStringId = (value) => {
  if (value === null || value === undefined) {
    return null
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
  }

  if (typeof value === 'number') {
    return String(value)
  }

  if (typeof value.toString === 'function') {
    const parsed = value.toString()
    return parsed === '[object Object]' ? null : parsed
  }

  return null
}

const isGameStarted = (status) =>
  String(status || '')
    .trim()
    .toLowerCase() === 'started'

const formatAnnouncementBody = (game) => {
  const gameName = typeof game?.name === 'string' && game.name.trim()
    ? game.name.trim()
    : 'Без названия'
  const startDateRaw = game?.dateStart ? new Date(game.dateStart) : null
  const hasStartDate = startDateRaw instanceof Date && !Number.isNaN(startDateRaw.getTime())
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
  if (sessionTelegramId && gameCreatorTelegramId && sessionTelegramId === gameCreatorTelegramId) {
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

  const gameTeams = await GamesTeams.find({ gameId })
    .select({ teamId: 1 })
    .lean()

  const teamIds = Array.from(
    new Set(gameTeams.map((item) => toStringId(item?.teamId)).filter(Boolean)),
  )

  if (teamIds.length === 0) {
    return []
  }

  const teamMemberships = await TeamsUsers.find({ teamId: { $in: teamIds } })
    .select({ userId: 1, userTelegramId: 1 })
    .lean()

  const userIds = Array.from(
    new Set(teamMemberships.map((item) => toStringId(item?.userId)).filter(Boolean)),
  )
  const objectIdUserIds = userIds.filter((value) => /^[0-9a-fA-F]{24}$/.test(value))
  const telegramIds = Array.from(
    new Set(
      teamMemberships
        .map((item) => Number(item?.userTelegramId))
        .filter((value) => Number.isFinite(value)),
    ),
  )

  if (objectIdUserIds.length === 0 && telegramIds.length === 0) {
    return []
  }

  const users = await Users.find({
    $or: [
      ...(objectIdUserIds.length > 0 ? [{ _id: { $in: objectIdUserIds } }] : []),
      ...(telegramIds.length > 0 ? [{ telegramId: { $in: telegramIds } }] : []),
    ],
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

const getAllUsersForBroadcast = async ({ db }) => {
  const Users = db.model('Users')
  const users = await Users.find({})
    .select({ _id: 1, telegramId: 1, pushSubscriptions: 1 })
    .lean()

  return users.filter((user) => Number.isFinite(Number(user?.telegramId)))
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({ success: false, error: 'Метод не поддерживается' })
  }

  const session = await getServerSession(req, res, authOptions)
  if (!session?.user) {
    return res.status(401).json({ success: false, error: 'Требуется авторизация' })
  }

  const gameId = toStringId(req.query?.gameId)
  if (!gameId) {
    return res.status(400).json({ success: false, error: 'Не передан идентификатор игры' })
  }

  const mode = typeof req.body?.mode === 'string' ? req.body.mode.trim() : ''
  const isAnnouncementForAll = mode === 'announce_all_users'
  const isCustomForRegistered = mode === 'custom_for_registered'

  if (!isAnnouncementForAll && !isCustomForRegistered) {
    return res.status(400).json({
      success: false,
      error: 'Некорректный режим рассылки',
    })
  }

  const customMessage = sanitizeCustomMessage(req.body?.message)
  if (isCustomForRegistered && customMessage.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Введите сообщение для отправки зарегистрированным командам',
    })
  }

  if (customMessage.length > 1200) {
    return res.status(400).json({
      success: false,
      error: 'Сообщение слишком длинное. Максимум 1200 символов.',
    })
  }

  try {
    const db = await dbConnectGlobal()
    if (!db) {
      return res.status(503).json({ success: false, error: 'База данных недоступна' })
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
      return res.status(404).json({ success: false, error: 'Игра не найдена' })
    }

    if (!isManagerOfGame({ sessionUser: session.user, game })) {
      return res.status(403).json({ success: false, error: 'Недостаточно прав для рассылки по этой игре' })
    }

    if (isGameStarted(game.status)) {
      return res.status(409).json({
        success: false,
        error: 'Во время процесса игры рассылка через карточку игры недоступна',
      })
    }

    const users = isAnnouncementForAll
      ? await getAllUsersForBroadcast({ db })
      : await getUsersForGameRegistrations({ db, gameId })

    const gameName = typeof game?.name === 'string' && game.name.trim()
      ? game.name.trim()
      : 'Без названия'
    const notification = {
      title: isAnnouncementForAll
        ? `Анонс игры «${gameName}»`
        : `Сообщение по игре «${gameName}»`,
      body: isAnnouncementForAll
        ? formatAnnouncementBody(game)
        : customMessage,
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

    return res.status(200).json({
      success: true,
      data: {
        mode,
        gameId,
        usersMatched: users.length,
        notificationsCreated: result?.created || 0,
        pushDelivered: result?.delivered || 0,
        invalidSubscriptionsRemoved: result?.removed || 0,
      },
    })
  } catch (error) {
    console.error('Failed to broadcast game push notification', error)
    return res.status(500).json({
      success: false,
      error: 'Не удалось отправить push-уведомления',
    })
  }
}
