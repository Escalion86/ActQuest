import normalizeUserProfile from '@helpers/normalizeUserProfile'

const toStringId = (value) => {
  if (!value && value !== 0) {
    return null
  }

  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'number') {
    return value.toString()
  }

  if (value && typeof value.toString === 'function') {
    const stringValue = value.toString()
    return stringValue === '[object Object]' ? null : stringValue
  }

  return null
}

const ensureDateISOString = (value) => {
  if (!value) {
    return null
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return null
  }

  return date.toISOString()
}

const ensureRole = (value) => {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim()
  }

  if (value) {
    return String(value)
  }

  return 'client'
}

const normalizeUserForAdmin = ({
  userDoc,
  membershipsByUser,
  teamsMap,
  gamesIdsByTeam,
}) => {
  const baseProfile = normalizeUserProfile(userDoc)
  const numericTelegramId = Number.isFinite(userDoc?.telegramId)
    ? Number(userDoc.telegramId)
    : null
  const telegramId = numericTelegramId !== null ? String(numericTelegramId) : ''
  const memberships = membershipsByUser[telegramId] ?? []

  const teams = memberships
    .map((membership) => {
      const teamId = membership.teamId
      const team = teamsMap[teamId] ?? null

      if (!team) {
        return null
      }

      const role = membership.role === 'capitan' ? 'capitan' : 'participant'
      const games = gamesIdsByTeam[teamId] ?? []

      return {
        id: teamId,
        name: team.name,
        role,
        isCaptain: role === 'capitan',
        gamesCount: games.length,
        updatedAt: ensureDateISOString(team.updatedAt),
      }
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.isCaptain === b.isCaptain) {
        return a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' })
      }

      return a.isCaptain ? -1 : 1
    })

  const uniqueGameIds = new Set()
  memberships.forEach((membership) => {
    const ids = gamesIdsByTeam[membership.teamId] ?? []
    ids.forEach((id) => uniqueGameIds.add(id))
  })

  return {
    ...baseProfile,
    globalUserId: userDoc?.globalUserId ? String(userDoc.globalUserId) : null,
    telegramId,
    role: ensureRole(userDoc?.role),
    createdAt: ensureDateISOString(userDoc?.createdAt),
    updatedAt: ensureDateISOString(userDoc?.updatedAt),
    teams,
    teamsCount: teams.length,
    gamesCount: uniqueGameIds.size,
  }
}

const toPositiveInteger = (value, fallback) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric < 0) {
    return fallback
  }
  return Math.floor(numeric)
}

const fetchAdminUsersForCabinet = async ({
  db,
  offset = 0,
  limit = 10,
}) => {
  if (!db) {
    return { users: [], hasMore: false }
  }

  const UsersModel = db.model('Users')
  const TeamsUsersModel = db.model('TeamsUsers')
  const TeamsModel = db.model('Teams')
  const GamesTeamsModel = db.model('GamesTeams')

  const queryOffset = toPositiveInteger(offset, 0)
  const queryLimit = toPositiveInteger(limit, 10)
  const fetchLimit = queryLimit + 1

  const usersDocs = await UsersModel.find({})
    .sort({ name: 1 })
    .skip(queryOffset)
    .limit(fetchLimit)
    .lean()

  if (!usersDocs.length) {
    return { users: [], hasMore: false }
  }

  const hasMore = usersDocs.length > queryLimit
  const usersSlice = usersDocs.slice(0, queryLimit)

  const membershipTelegramIds = Array.from(
    new Set(
      usersSlice
        .map((userDoc) =>
          Number.isFinite(userDoc?.telegramId) ? Number(userDoc.telegramId) : null
        )
        .filter((id) => id !== null)
    )
  )

  const membershipsDocs = membershipTelegramIds.length
    ? await TeamsUsersModel.find({ userTelegramId: { $in: membershipTelegramIds } })
        .select({ teamId: 1, userTelegramId: 1, role: 1 })
        .lean()
    : []

  const teamIds = Array.from(
    new Set(
      membershipsDocs
        .map((doc) => toStringId(doc?.teamId))
        .filter((teamId) => typeof teamId === 'string' && teamId.length > 0)
    )
  )

  const teamsDocs = teamIds.length
    ? await TeamsModel.find({ _id: { $in: teamIds } })
        .select({ _id: 1, name: 1, updatedAt: 1 })
        .lean()
    : []

  const gamesTeamsDocs = teamIds.length
    ? await GamesTeamsModel.find({ teamId: { $in: teamIds } })
        .select({ teamId: 1, gameId: 1 })
        .lean()
    : []

  const teamsMap = teamsDocs.reduce((acc, team) => {
    const id = toStringId(team?._id)
    if (id) {
      acc[id] = {
        id,
        name: typeof team?.name === 'string' ? team.name : '',
        updatedAt: team?.updatedAt ?? null,
      }
    }
    return acc
  }, {})

  const membershipsByUser = membershipsDocs.reduce((acc, doc) => {
    const telegramId = Number.isFinite(doc?.userTelegramId)
      ? String(doc.userTelegramId)
      : null
    const teamId = toStringId(doc?.teamId)

    if (!telegramId || !teamId) {
      return acc
    }

    if (!acc[telegramId]) {
      acc[telegramId] = []
    }

    acc[telegramId].push({
      teamId,
      role: doc?.role === 'capitan' ? 'capitan' : 'participant',
    })

    return acc
  }, {})

  const gamesIdsByTeamSet = gamesTeamsDocs.reduce((acc, doc) => {
    const teamId = toStringId(doc?.teamId)
    const gameId = toStringId(doc?.gameId)

    if (!teamId || !gameId) {
      return acc
    }

    if (!acc[teamId]) {
      acc[teamId] = new Set()
    }

    acc[teamId].add(gameId)
    return acc
  }, {})

  const gamesIdsByTeam = Object.entries(gamesIdsByTeamSet).reduce(
    (acc, [teamId, ids]) => {
      acc[teamId] = Array.from(ids)
      return acc
    },
    {}
  )

  const users = usersSlice
    .map((userDoc) =>
      normalizeUserForAdmin({
        userDoc,
        membershipsByUser,
        teamsMap,
        gamesIdsByTeam,
      })
    )
    .sort((a, b) => a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' }))

  return { users, hasMore }
}

export default fetchAdminUsersForCabinet
