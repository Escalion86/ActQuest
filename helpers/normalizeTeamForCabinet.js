const ensureString = (value, fallback = '') => {
  if (typeof value === 'string') {
    return value
  }

  if (value === null || value === undefined) {
    return fallback
  }

  if (typeof value === 'number') {
    return value.toString()
  }

  if (typeof value.toString === 'function') {
    const stringValue = value.toString()
    return stringValue === '[object Object]' ? fallback : stringValue
  }

  return fallback
}

const ensureBoolean = (value, fallback = false) => {
  if (typeof value === 'boolean') {
    return value
  }

  if (value === null || value === undefined) {
    return fallback
  }

  if (value === 'true') return true
  if (value === 'false') return false

  return Boolean(value)
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

const ensurePhone = (value) => {
  const stringValue = ensureString(value, '')

  if (!stringValue) {
    return ''
  }

  return stringValue.startsWith('+') ? stringValue : `+${stringValue}`
}

const normalizeMembers = (members = []) => {
  if (!Array.isArray(members) || members.length === 0) {
    return []
  }

  const normalized = members.map((member, index) => {
    const role = member?.role === 'capitan' ? 'capitan' : 'participant'
    const user = member?.user ?? {}

    const rawTelegramId =
      member?.userTelegramId ??
      member?.telegramId ??
      user?.telegramId ??
      null

    return {
      id: ensureString(member?.membershipId ?? member?._id ?? member?.id, `member-${index}`),
      telegramId: ensureString(rawTelegramId, ''),
      role,
      isCaptain: role === 'capitan',
      name: ensureString(user?.name, ''),
      username: ensureString(user?.username, ''),
      phone: ensurePhone(user?.phone),
      userRole: ensureString(user?.role, ''),
    }
  })

  return normalized.sort((a, b) => {
    if (a.isCaptain === b.isCaptain) {
      return a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' })
    }

    return a.isCaptain ? -1 : 1
  })
}

const normalizeGames = (games = []) => {
  if (!Array.isArray(games) || games.length === 0) {
    return []
  }

  return games
    .map((game, index) => ({
      id: ensureString(game?._id ?? game?.id, `game-${index}`),
      name: ensureString(game?.name, ''),
      status: ensureString(game?.status, ''),
      dateStart: ensureDateISOString(game?.dateStart),
      hidden: ensureBoolean(game?.hidden, false),
    }))
    .sort((a, b) => {
      const dateA = a.dateStart ? new Date(a.dateStart).getTime() : 0
      const dateB = b.dateStart ? new Date(b.dateStart).getTime() : 0
      return dateB - dateA
    })
}

const normalizeTeamForCabinet = ({ team, members, games }) => {
  if (!team) {
    return null
  }

  const id = ensureString(team?._id ?? team?.id)
  const normalizedMembers = normalizeMembers(members)
  const normalizedGames = normalizeGames(games)

  const captain = normalizedMembers.find((member) => member.isCaptain) ?? null

  return {
    id,
    name: ensureString(team?.name, ''),
    description: ensureString(team?.description, ''),
    open: ensureBoolean(team?.open, true),
    members: normalizedMembers,
    membersCount: normalizedMembers.length,
    captain,
    games: normalizedGames,
    gamesCount: normalizedGames.length,
    createdAt: ensureDateISOString(team?.createdAt),
    updatedAt: ensureDateISOString(team?.updatedAt),
  }
}

export default normalizeTeamForCabinet
