import { toStringId } from '@helpers/idAndDate'

const normalizeString = (value) =>
  typeof value === 'string'
    ? value.trim()
    : Number.isFinite(value)
      ? String(value).trim()
      : ''

const normalizeRole = (value) => {
  const normalized = normalizeString(value).toLowerCase()
  return ['client', 'moder', 'admin', 'dev'].includes(normalized)
    ? normalized
    : 'client'
}

const isElevatedRole = (role) => role === 'admin' || role === 'dev'

const resolveSessionIdentity = (session) => {
  const sessionUser = session?.user ?? {}

  return {
    userId: toStringId(
      sessionUser.globalUserId ??
        sessionUser.userId ??
        sessionUser._id ??
        sessionUser.id ??
        null,
    ),
    userTelegramId:
      sessionUser.telegramId !== null && sessionUser.telegramId !== undefined
        ? String(sessionUser.telegramId).trim()
        : '',
    role: normalizeRole(sessionUser.role),
  }
}

const canManageGameHistory = ({ session, game }) => {
  const identity = resolveSessionIdentity(session)
  if (!game) {
    return false
  }

  if (isElevatedRole(identity.role)) {
    return true
  }

  const creatorUserId = toStringId(game?.creatorUserId)
  if (identity.userId && creatorUserId && identity.userId === creatorUserId) {
    return true
  }

  const creatorTelegramId =
    game?.creatorTelegramId !== null && game?.creatorTelegramId !== undefined
      ? String(game.creatorTelegramId).trim()
      : ''

  if (
    identity.userTelegramId &&
    creatorTelegramId &&
    identity.userTelegramId === creatorTelegramId
  ) {
    return true
  }

  if (!identity.userId) {
    return false
  }

  const moderators = Array.isArray(game?.moderators) ? game.moderators : []
  return moderators.some((moderator) => {
    if (!moderator) {
      return false
    }

    if (typeof moderator === 'string') {
      return toStringId(moderator) === identity.userId
    }

    return toStringId(moderator?._id ?? moderator?.id) === identity.userId
  })
}

// Единая проверка права управлять игрой. История, настройки, запуск и остановка
// должны использовать одну и ту же модель доступа.
const canManageGame = canManageGameHistory

const buildHistoryActorFromSession = (session) => ({
  userId:
    session?.user?.globalUserId ??
    session?.user?.userId ??
    session?.user?._id ??
    session?.user?.id ??
    null,
  telegramId:
    session?.user?.telegramId !== null && session?.user?.telegramId !== undefined
      ? String(session.user.telegramId).trim()
      : null,
  role: typeof session?.user?.role === 'string' ? session.user.role : '',
  name: typeof session?.user?.name === 'string' ? session.user.name : '',
})

export {
  canManageGame,
  canManageGameHistory,
  buildHistoryActorFromSession,
  normalizeRole,
  resolveSessionIdentity,
}
