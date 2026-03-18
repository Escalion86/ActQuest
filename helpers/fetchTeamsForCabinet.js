import normalizeTeamForCabinet from '@helpers/normalizeTeamForCabinet'

const toStringId = (value) => {
  if (!value) {
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

const ensureArray = (value) => (Array.isArray(value) ? value : [])

const toPositiveInteger = (value, fallback) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric < 0) {
    return fallback
  }
  return Math.floor(numeric)
}

const fetchTeamsForCabinet = async ({
  db,
  teamIds = null,
  offset = 0,
  limit = null,
  returnMeta = false,
}) => {
  if (!db) {
    return returnMeta ? { teams: [], hasMore: false } : []
  }

  const TeamsModel = db.model('Teams')
  const TeamsUsersModel = db.model('TeamsUsers')
  const UsersModel = db.model('Users')
  const GamesTeamsModel = db.model('GamesTeams')
  const GamesModel = db.model('Games')

  const uniqueTeamIds = Array.isArray(teamIds)
    ? Array.from(
        new Set(
          teamIds
            .map((teamId) => toStringId(teamId))
            .filter((teamId) => typeof teamId === 'string' && teamId.length > 0)
        )
      )
    : null

  if (Array.isArray(uniqueTeamIds) && uniqueTeamIds.length === 0) {
    return returnMeta ? { teams: [], hasMore: false } : []
  }

  const teamFilter = Array.isArray(uniqueTeamIds) ? { _id: { $in: uniqueTeamIds } } : {}
  const queryOffset = toPositiveInteger(offset, 0)
  const queryLimit = limit === null ? null : toPositiveInteger(limit, 0)
  const shouldPaginate = Number.isFinite(queryLimit) && queryLimit > 0
  const fetchLimit = shouldPaginate ? queryLimit + 1 : null

  let teamsQuery = TeamsModel.find(teamFilter).sort({ updatedAt: -1 }).skip(queryOffset)
  if (shouldPaginate) {
    teamsQuery = teamsQuery.limit(fetchLimit)
  }

  const teamsDocs = await teamsQuery.lean()

  if (!teamsDocs || teamsDocs.length === 0) {
    return returnMeta ? { teams: [], hasMore: false } : []
  }

  const hasMore = shouldPaginate ? teamsDocs.length > queryLimit : false
  const teamsSlice = shouldPaginate ? teamsDocs.slice(0, queryLimit) : teamsDocs

  const normalizedTeamIds = teamsSlice
    .map((team) => toStringId(team?._id))
    .filter((teamId) => typeof teamId === 'string' && teamId.length > 0)

  if (normalizedTeamIds.length === 0) {
    return returnMeta ? { teams: [], hasMore } : []
  }

  const teamMembersDocs = await TeamsUsersModel.find({ teamId: { $in: normalizedTeamIds } }).lean()
  const memberUserIds = Array.from(
    new Set(
      ensureArray(teamMembersDocs)
        .map((doc) => toStringId(doc?.userId))
        .filter((userId) => typeof userId === 'string' && userId.length > 0)
    )
  )
  const memberTelegramIds = Array.from(
    new Set(
      ensureArray(teamMembersDocs)
        .map((doc) => doc?.userTelegramId)
        .filter((telegramId) => Number.isFinite(telegramId))
    )
  )

  const usersByIdDocs = memberUserIds.length
    ? await UsersModel.find({ _id: { $in: memberUserIds } })
        .select({ _id: 1, telegramId: 1, name: 1, username: 1, phone: 1, role: 1 })
        .lean()
    : []

  const usersByTelegramDocs = memberTelegramIds.length
    ? await UsersModel.find({ telegramId: { $in: memberTelegramIds } })
        .select({ _id: 1, telegramId: 1, name: 1, username: 1, phone: 1, role: 1 })
        .lean()
    : []

  const usersByIdMap = ensureArray(usersByIdDocs).reduce((acc, user) => {
    const userId = toStringId(user?._id)

    if (userId) {
      acc[userId] = user
    }

    return acc
  }, {})

  const usersByTelegramMap = ensureArray(usersByTelegramDocs).reduce((acc, user) => {
    const telegramId = Number.isFinite(user?.telegramId) ? user.telegramId : null

    if (telegramId !== null) {
      acc[telegramId] = user
    }

    return acc
  }, {})

  const membersByTeam = ensureArray(teamMembersDocs).reduce((acc, membership) => {
    const teamId = toStringId(membership?.teamId)
    const userId = toStringId(membership?.userId)

    if (!teamId) {
      return acc
    }

    if (!acc[teamId]) {
      acc[teamId] = []
    }

    const linkedUser =
      (userId ? usersByIdMap[userId] ?? null : null) ??
      usersByTelegramMap[membership?.userTelegramId] ??
      null

    acc[teamId].push({
      membershipId: membership?._id,
      userId: userId ?? null,
      userTelegramId: membership?.userTelegramId ?? null,
      role: membership?.role,
      user: linkedUser,
    })

    return acc
  }, {})

  const gamesTeamsDocs = await GamesTeamsModel.find({ teamId: { $in: normalizedTeamIds } })
    .select({ teamId: 1, gameId: 1 })
    .lean()

  const gameIds = Array.from(
    new Set(
      ensureArray(gamesTeamsDocs)
        .map((doc) => toStringId(doc?.gameId))
        .filter((gameId) => typeof gameId === 'string' && gameId.length > 0)
    )
  )

  const gamesDocs = gameIds.length
    ? await GamesModel.find({ _id: { $in: gameIds } })
        .select({ _id: 1, name: 1, status: 1, dateStart: 1, hidden: 1 })
        .lean()
    : []

  const gamesMap = ensureArray(gamesDocs).reduce((acc, game) => {
    const gameId = toStringId(game?._id)

    if (gameId) {
      acc[gameId] = game
    }

    return acc
  }, {})

  const gamesByTeam = ensureArray(gamesTeamsDocs).reduce((acc, doc) => {
    const teamId = toStringId(doc?.teamId)
    const gameId = toStringId(doc?.gameId)
    const game = gameId ? gamesMap[gameId] ?? null : null

    if (!teamId || !game) {
      return acc
    }

    if (!acc[teamId]) {
      acc[teamId] = []
    }

    acc[teamId].push(game)

    return acc
  }, {})

  const teams = teamsSlice
    .map((team) =>
      normalizeTeamForCabinet({
        team,
        members: membersByTeam[toStringId(team?._id)] ?? [],
        games: gamesByTeam[toStringId(team?._id)] ?? [],
      })
    )
    .filter(Boolean)

  if (returnMeta) {
    return { teams, hasMore }
  }

  return teams
}

export default fetchTeamsForCabinet
