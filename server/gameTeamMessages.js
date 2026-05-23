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

export const getTeamMessageReadUserKey = ({ userId, telegramId }) => {
  const normalizedUserId = toStringId(userId)
  if (normalizedUserId) return `user:${normalizedUserId}`

  const normalizedTelegramId = toStringId(telegramId)
  if (normalizedTelegramId) return `tg:${normalizedTelegramId}`

  return ''
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

const resolveUserReadAt = (message, teamId, userKey) => {
  const normalizedTeamId = toStringId(teamId)
  const normalizedUserKey = typeof userKey === 'string' ? userKey.trim() : ''
  if (!normalizedTeamId || !normalizedUserKey) return null

  const read = (Array.isArray(message?.userReads) ? message.userReads : []).find(
    (item) =>
      toStringId(item?.teamId) === normalizedTeamId &&
      String(item?.userKey || '') === normalizedUserKey,
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
  userReadAt: resolveUserReadAt(message, options.teamId, options.userKey),
  createdAt: toIsoString(message?.createdAt),
  updatedAt: toIsoString(message?.updatedAt),
})

export const fetchGameTeamMessages = async ({ db, gameId, teamId, limit, userKey }) => {
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
    .map((message) =>
      mapGameTeamMessage(message, { teamId: normalizedTeamId, userKey }),
    )
}

export const deleteGameTeamMessagesForGame = async ({ db, gameId }) => {
  const normalizedGameId = toStringId(gameId)
  if (!normalizedGameId) return 0

  const result = await db.model('GameTeamMessages').deleteMany({
    gameId: normalizedGameId,
  })

  return Number(result?.deletedCount || 0)
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

export const markAdminMessagesReadByTeam = async ({ db, gameId, teamId, userKey }) => {
  const normalizedGameId = toStringId(gameId)
  const normalizedTeamId = toStringId(teamId)
  if (!normalizedGameId || !normalizedTeamId) return 0
  const normalizedUserKey = typeof userKey === 'string' ? userKey.trim() : ''

  const model = db.model('GameTeamMessages')
  const teamReadResult = await model.updateMany(
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

  let userReadModifiedCount = 0
  if (normalizedUserKey) {
    const userReadResult = await model.updateMany(
      {
        gameId: normalizedGameId,
        direction: 'admin_to_team',
        userReads: {
          $not: {
            $elemMatch: {
              teamId: normalizedTeamId,
              userKey: normalizedUserKey,
            },
          },
        },
        $or: [
          { scope: 'game', teamId: null },
          { scope: 'game', teamId: { $exists: false } },
          { scope: 'team', teamId: normalizedTeamId },
        ],
      },
      {
        $push: {
          userReads: {
            teamId: normalizedTeamId,
            userKey: normalizedUserKey,
            readAt: new Date(),
          },
        },
      },
    )
    userReadModifiedCount = Number(userReadResult?.modifiedCount || 0)
  }

  return Math.max(Number(teamReadResult?.modifiedCount || 0), userReadModifiedCount)
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

export const fetchUnreadAdminMessageCountForTeam = async ({
  db,
  gameId,
  teamId,
  userKey,
}) => {
  const normalizedGameId = toStringId(gameId)
  const normalizedTeamId = toStringId(teamId)
  const normalizedUserKey = typeof userKey === 'string' ? userKey.trim() : ''
  if (!normalizedGameId || !normalizedTeamId || !normalizedUserKey) return 0

  const count = await db.model('GameTeamMessages').countDocuments({
    gameId: normalizedGameId,
    direction: 'admin_to_team',
    userReads: {
      $not: {
        $elemMatch: {
          teamId: normalizedTeamId,
          userKey: normalizedUserKey,
        },
      },
    },
    $or: [
      { scope: 'game', teamId: null },
      { scope: 'game', teamId: { $exists: false } },
      { scope: 'team', teamId: normalizedTeamId },
    ],
  })

  return Number(count || 0)
}

export const fetchGameTeamDialogSummaries = async ({ db, gameId }) => {
  const normalizedGameId = toStringId(gameId)
  if (!normalizedGameId) return []

  const gameTeamDocs = await db
    .model('GamesTeams')
    .find({ gameId: normalizedGameId })
    .select({ teamId: 1, createdAt: 1 })
    .lean()

  const teamIds = Array.from(
    new Set(gameTeamDocs.map((item) => toStringId(item?.teamId)).filter(Boolean)),
  )
  if (teamIds.length === 0) return []

  const [teams, unreadCounts, lastMessages] = await Promise.all([
    db
      .model('Teams')
      .find({ _id: { $in: teamIds } })
      .select({ _id: 1, name: 1, image: 1, members: 1 })
      .lean(),
    fetchUnreadTeamMessageCounts({ db, gameId: normalizedGameId }),
    db
      .model('GameTeamMessages')
      .aggregate([
        {
          $match: {
            gameId: normalizedGameId,
            scope: 'team',
            teamId: { $in: teamIds },
          },
        },
        { $sort: { createdAt: -1, _id: -1 } },
        {
          $group: {
            _id: '$teamId',
            message: { $first: '$$ROOT' },
          },
        },
      ]),
  ])

  const teamById = teams.reduce((acc, team) => {
    const teamId = toStringId(team?._id)
    if (teamId) acc[teamId] = team
    return acc
  }, {})
  const registrationByTeamId = gameTeamDocs.reduce((acc, item) => {
    const teamId = toStringId(item?.teamId)
    if (teamId && !acc[teamId]) acc[teamId] = item
    return acc
  }, {})
  const lastMessageByTeamId = lastMessages.reduce((acc, row) => {
    const teamId = toStringId(row?._id)
    if (teamId) acc[teamId] = row?.message || null
    return acc
  }, {})

  return teamIds
    .map((teamId) => {
      const team = teamById[teamId] || {}
      const lastMessage = lastMessageByTeamId[teamId]
      return {
        teamId,
        teamName:
          typeof team?.name === 'string' && team.name.trim()
            ? team.name.trim()
            : 'Без названия',
        teamImage: typeof team?.image === 'string' ? team.image : '',
        membersCount: Array.isArray(team?.members) ? team.members.length : 0,
        unreadCount: Number(unreadCounts[teamId] || 0),
        lastMessage: lastMessage
          ? mapGameTeamMessage(lastMessage, { teamId })
          : null,
        lastMessageAt: toIsoString(lastMessage?.createdAt),
        registeredAt: toIsoString(registrationByTeamId[teamId]?.createdAt),
      }
    })
    .sort((first, second) => {
      const firstTime = first.lastMessageAt
        ? new Date(first.lastMessageAt).getTime()
        : 0
      const secondTime = second.lastMessageAt
        ? new Date(second.lastMessageAt).getTime()
        : 0
      if (firstTime !== secondTime) return secondTime - firstTime
      if (first.unreadCount !== second.unreadCount) {
        return second.unreadCount - first.unreadCount
      }
      return first.teamName.localeCompare(second.teamName, 'ru', {
        sensitivity: 'base',
      })
    })
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
