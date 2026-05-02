import { toStringId } from '@helpers/idAndDate'

export const GAME_TEAM_MESSAGE_LIMIT = 100

export const getSessionUserId = (sessionUser) => {
  const rawId =
    sessionUser?.globalUserId ||
    sessionUser?.userId ||
    sessionUser?._id ||
    sessionUser?.id ||
    null

  return rawId ? String(rawId) : ''
}

export const normalizeMessageBody = (value) =>
  typeof value === 'string' ? value.trim().slice(0, 2000) : ''

export const normalizeRole = (value) => {
  if (typeof value !== 'string') return 'client'
  const role = value.trim().toLowerCase()
  return ['client', 'moder', 'admin', 'dev'].includes(role) ? role : 'client'
}

export const isGameManager = ({ sessionUser, game }) => {
  if (!sessionUser || !game) return false

  const role = normalizeRole(sessionUser.role)
  if (role === 'admin' || role === 'dev') return true

  const sessionUserId = getSessionUserId(sessionUser)
  const creatorUserId = toStringId(game.creatorUserId)
  if (sessionUserId && creatorUserId && sessionUserId === creatorUserId) {
    return true
  }

  const sessionTelegramId = toStringId(sessionUser.telegramId)
  const creatorTelegramId = toStringId(game.creatorTelegramId)
  if (
    sessionTelegramId &&
    creatorTelegramId &&
    sessionTelegramId === creatorTelegramId
  ) {
    return true
  }

  if (!sessionUserId) return false

  const moderators = Array.isArray(game.moderators) ? game.moderators : []
  return moderators.some((moderator) => {
    if (!moderator) return false
    if (typeof moderator === 'string') {
      return toStringId(moderator) === sessionUserId
    }
    return toStringId(moderator?._id ?? moderator?.id) === sessionUserId
  })
}

const toIsoString = (value) => {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

const resolveTeamReadAt = (message, teamId) => {
  const normalizedTeamId = toStringId(teamId)
  if (!normalizedTeamId) return null

  const read = (Array.isArray(message?.teamReads) ? message.teamReads : []).find(
    (item) => toStringId(item?.teamId) === normalizedTeamId,
  )

  return toIsoString(read?.readAt)
}

export const mapGameTeamMessage = (message, options = {}) => ({
  id: String(message?._id || ''),
  gameId: String(message?.gameId || ''),
  teamId: message?.teamId ? String(message.teamId) : null,
  scope: message?.scope || 'team',
  direction: message?.direction || 'admin_to_team',
  body: String(message?.body || ''),
  createdByUserId: String(message?.createdByUserId || ''),
  createdByRole: message?.createdByRole || '',
  createdByName: String(message?.createdByName || ''),
  pushRequested: Boolean(message?.pushRequested),
  pushUsersMatched: Number(message?.pushUsersMatched || 0),
  pushNotificationsCreated: Number(message?.pushNotificationsCreated || 0),
  pushDelivered: Number(message?.pushDelivered || 0),
  pushError: message?.pushError ? String(message.pushError) : null,
  readByAdminAt: toIsoString(message?.readByAdminAt),
  teamReadAt: resolveTeamReadAt(message, options.teamId),
  createdAt: toIsoString(message?.createdAt),
  updatedAt: toIsoString(message?.updatedAt),
})

export const fetchGameTeamMessages = async ({ db, gameId, teamId, limit }) => {
  const GameTeamMessages = db.model('GameTeamMessages')
  const normalizedGameId = toStringId(gameId)
  const normalizedTeamId = teamId ? toStringId(teamId) : ''
  const safeLimit = Math.min(
    Math.max(Number(limit) || GAME_TEAM_MESSAGE_LIMIT, 1),
    GAME_TEAM_MESSAGE_LIMIT,
  )

  const query = {
    gameId: normalizedGameId,
    $or: [
      { scope: 'game', teamId: null },
      { scope: 'game', teamId: { $exists: false } },
    ],
  }

  if (normalizedTeamId) {
    query.$or.push({ scope: 'team', teamId: normalizedTeamId })
  }

  const messages = await GameTeamMessages.find(query)
    .sort({ createdAt: -1, _id: -1 })
    .limit(safeLimit)
    .lean()

  return messages
    .reverse()
    .map((message) => mapGameTeamMessage(message, { teamId: normalizedTeamId }))
}

export const markTeamMessagesReadByAdmin = async ({ db, gameId, teamId }) => {
  const normalizedGameId = toStringId(gameId)
  const normalizedTeamId = toStringId(teamId)
  if (!normalizedGameId || !normalizedTeamId) return 0

  const result = await db.model('GameTeamMessages').updateMany(
    {
      gameId: normalizedGameId,
      teamId: normalizedTeamId,
      direction: 'team_to_admin',
      readByAdminAt: null,
    },
    { $set: { readByAdminAt: new Date() } },
  )

  return Number(result?.modifiedCount || 0)
}

export const markAdminMessagesReadByTeam = async ({ db, gameId, teamId }) => {
  const normalizedGameId = toStringId(gameId)
  const normalizedTeamId = toStringId(teamId)
  if (!normalizedGameId || !normalizedTeamId) return 0

  const result = await db.model('GameTeamMessages').updateMany(
    {
      gameId: normalizedGameId,
      direction: 'admin_to_team',
      'teamReads.teamId': { $ne: normalizedTeamId },
      $or: [
        { scope: 'game', teamId: null },
        { scope: 'game', teamId: { $exists: false } },
        { scope: 'team', teamId: normalizedTeamId },
      ],
    },
    {
      $push: {
        teamReads: {
          teamId: normalizedTeamId,
          readAt: new Date(),
        },
      },
    },
  )

  return Number(result?.modifiedCount || 0)
}

export const fetchUnreadTeamMessageCounts = async ({ db, gameId }) => {
  const normalizedGameId = toStringId(gameId)
  if (!normalizedGameId) return {}

  const rows = await db
    .model('GameTeamMessages')
    .aggregate([
      {
        $match: {
          gameId: normalizedGameId,
          direction: 'team_to_admin',
          readByAdminAt: null,
          teamId: { $exists: true, $nin: [null, ''] },
        },
      },
      {
        $group: {
          _id: '$teamId',
          count: { $sum: 1 },
        },
      },
    ])

  return rows.reduce((acc, row) => {
    const teamId = toStringId(row?._id)
    if (teamId) acc[teamId] = Number(row?.count || 0)
    return acc
  }, {})
}

export const getRegisteredTeamIds = async ({ db, gameId }) => {
  const gameTeams = await db
    .model('GamesTeams')
    .find({ gameId: toStringId(gameId) })
    .select({ teamId: 1 })
    .lean()

  return Array.from(
    new Set(gameTeams.map((item) => toStringId(item?.teamId)).filter(Boolean)),
  )
}

export const getUsersForTeamIds = async ({ db, teamIds }) => {
  const normalizedTeamIds = Array.from(
    new Set((Array.isArray(teamIds) ? teamIds : []).map(toStringId).filter(Boolean)),
  )
  if (normalizedTeamIds.length === 0) return []

  const memberships = await db
    .model('TeamsUsers')
    .find({ teamId: { $in: normalizedTeamIds } })
    .select({ userId: 1 })
    .lean()

  const userIds = Array.from(
    new Set(
      memberships
        .map((item) => toStringId(item?.userId))
        .filter((value) => /^[0-9a-fA-F]{24}$/.test(value)),
    ),
  )
  if (userIds.length === 0) return []

  const users = await db
    .model('Users')
    .find({ _id: { $in: userIds } })
    .select({ _id: 1, pushSubscriptions: 1 })
    .lean()

  const uniqueByUserId = new Map()
  users.forEach((user) => {
    const userId = toStringId(user?._id)
    if (userId) uniqueByUserId.set(userId, user)
  })

  return Array.from(uniqueByUserId.values())
}

export const getTeamMembershipForUser = async ({ db, teamId, userId, telegramId }) => {
  const normalizedTeamId = toStringId(teamId)
  const normalizedUserId = toStringId(userId)
  const normalizedTelegramId = toStringId(telegramId)

  const query = { teamId: normalizedTeamId, $or: [] }
  if (normalizedUserId) query.$or.push({ userId: normalizedUserId })
  if (normalizedTelegramId) query.$or.push({ userTelegramId: Number(telegramId) })
  if (query.$or.length === 0) return null

  return db.model('TeamsUsers').findOne(query).select({ role: 1 }).lean()
}
