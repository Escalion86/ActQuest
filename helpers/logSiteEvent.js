import dbConnectGlobal from '@utils/dbConnectGlobal'
import { LOCATIONS } from '@server/serverConstants'
import { broadcastNotificationToUsers } from '@server/pwaNotifications'
import { toStringId } from '@helpers/idAndDate'

const normalizeLocation = (value) => {
  if (typeof value !== 'string') {
    return null
  }
  const normalized = value.trim().toLowerCase()
  return normalized.length > 0 ? normalized : null
}

const normalizeText = (value) => {
  if (typeof value !== 'string') {
    return ''
  }
  return value.trim()
}

const normalizeNumber = (value) => {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

const EVENT_TYPE_LABELS = {
  user_registered: 'Новая регистрация',
  team_created: 'Создана команда',
  team_deleted: 'Удалена команда',
  team_registered_to_game: 'Команда зарегистрирована на игру',
  team_unregistered_from_game: 'Команда снята с игры',
  game_order_created: 'Новая заявка на игру',
  client_diagnostic: 'Клиентская диагностика',
}

const isAdminRole = (role) =>
  typeof role === 'string' &&
  ['admin', 'dev'].includes(role.trim().toLowerCase())

const isLocationAllowed = (location) =>
  typeof location === 'string' &&
  location.trim().length > 0 &&
  Boolean(LOCATIONS[location.trim().toLowerCase()])

const logSiteEvent = async ({
  db = null,
  type,
  location = null,
  message = '',
  actorUserId = null,
  actorTelegramId = null,
  targetUserId = null,
  teamId = null,
  teamName = '',
  gameId = null,
  gameName = '',
  metadata = {},
} = {}) => {
  if (!type || typeof type !== 'string') {
    return null
  }

  try {
    const connection = db || (await dbConnectGlobal())
    if (!connection) {
      return null
    }

    const SiteEventsModel = connection.model('SiteEvents')
    const created = await SiteEventsModel.create({
      type: type.trim(),
      location: normalizeLocation(location),
      message: normalizeText(message),
      actorUserId: toStringId(actorUserId),
      actorTelegramId: normalizeNumber(actorTelegramId),
      targetUserId: toStringId(targetUserId),
      teamId: toStringId(teamId),
      teamName: normalizeText(teamName),
      gameId: toStringId(gameId),
      gameName: normalizeText(gameName),
      metadata: metadata && typeof metadata === 'object' ? metadata : {},
    })

    const normalizedLocation = normalizeLocation(location)
    if (isLocationAllowed(normalizedLocation)) {
      try {
        const UsersModel = connection.model('Users')
        const admins = await UsersModel.find({
          role: { $in: ['admin', 'dev'] },
          adminEventPushLocations: { $in: [normalizedLocation] },
        })
          .select({
            _id: 1,
            telegramId: 1,
            pushSubscriptions: 1,
            role: 1,
            adminEventPushLocations: 1,
          })
          .lean()

        const targetUsers = (Array.isArray(admins) ? admins : []).filter(
          (user) =>
            isAdminRole(user?.role) &&
            Array.isArray(user?.pushSubscriptions) &&
            user.pushSubscriptions.length > 0,
        )

        if (targetUsers.length > 0) {
          await broadcastNotificationToUsers({
            db: connection,
            users: targetUsers,
            notification: {
              title: `Событие: ${EVENT_TYPE_LABELS[type] || type}`,
              body:
                normalizeText(message) || 'На сайте произошло новое событие.',
              tag: `admin-site-event-${String(type).trim()}-${Date.now()}`,
              location: normalizedLocation,
              data: {
                type: 'admin_site_event',
                eventType: String(type).trim(),
                eventId: toStringId(created?._id),
                location: normalizedLocation,
                url: '/cabinet/admin/events',
              },
              url: '/cabinet/admin/events',
            },
          })
        }
      } catch (pushError) {
        console.error('Failed to broadcast admin event push', {
          type,
          message: pushError?.message || 'unknown',
        })
      }
    }

    return created
  } catch (error) {
    console.error('Failed to log site event', {
      type,
      message: error?.message || 'unknown',
    })
    return null
  }
}

export default logSiteEvent
