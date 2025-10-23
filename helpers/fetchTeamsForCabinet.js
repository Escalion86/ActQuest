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

const fetchTeamsForCabinet = async ({ db, teamIds = null }) => {
  if (!db) {
    return []
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
    return []
  }

  const teamFilter = Array.isArray(uniqueTeamIds) ? { _id: { $in: uniqueTeamIds } } : {}

  const teamsDocs = await TeamsModel.find(teamFilter).sort({ updatedAt: -1 }).lean()

  if (!teamsDocs || teamsDocs.length === 0) {
    return []
  }

  const normalizedTeamIds = teamsDocs
    .map((team) => toStringId(team?._id))
    .filter((teamId) => typeof teamId === 'string' && teamId.length > 0)

  if (normalizedTeamIds.length === 0) {
    return []
  }

  const teamMembersDocs = await TeamsUsersModel.find({ teamId: { $in: normalizedTeamIds } }).lean()
  const memberTelegramIds = Array.from(
    new Set(
      ensureArray(teamMembersDocs)
        .map((doc) => doc?.userTelegramId)
        .filter((telegramId) => Number.isFinite(telegramId))
    )
  )

  const usersDocs = memberTelegramIds.length
    ? await UsersModel.find({ telegramId: { $in: memberTelegramIds } })
        .select({ telegramId: 1, name: 1, username: 1, phone: 1, role: 1 })
        .lean()
    : []

  const usersMap = ensureArray(usersDocs).reduce((acc, user) => {
    const telegramId = Number.isFinite(user?.telegramId) ? user.telegramId : null

    if (telegramId !== null) {
      acc[telegramId] = user
    }

    return acc
  }, {})

  const membersByTeam = ensureArray(teamMembersDocs).reduce((acc, membership) => {
    const teamId = toStringId(membership?.teamId)

    if (!teamId) {
      return acc
    }

    if (!acc[teamId]) {
      acc[teamId] = []
    }

    acc[teamId].push({
      membershipId: membership?._id,
      userTelegramId: membership?.userTelegramId ?? null,
      role: membership?.role,
      user: usersMap[membership?.userTelegramId] ?? null,
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

  return teamsDocs
    .map((team) =>
      normalizeTeamForCabinet({
        team,
        members: membersByTeam[toStringId(team?._id)] ?? [],
        games: gamesByTeam[toStringId(team?._id)] ?? [],
      })
    )
    .filter(Boolean)
}

export default fetchTeamsForCabinet
