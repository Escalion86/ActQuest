import { normalizeTeamCarSkin } from '@helpers/teamCarSkins'
import { ensureDateISOString } from '@helpers/idAndDate'
import resolveEntityRating from '@helpers/resolveEntityRating'

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
      member?.userTelegramId ?? member?.telegramId ?? user?.telegramId ?? null
    const rawUserId = member?.userId ?? user?._id ?? null
    const hasLinkedUser = Boolean(user && Object.keys(user).length > 0)
    const fallbackName = ensureString(
      user?.username
        ? `@${user.username}`
        : rawTelegramId
          ? `Участник ${rawTelegramId}`
          : '',
      'Участник без профиля',
    )

    return {
      id: ensureString(
        member?.membershipId ?? member?._id ?? member?.id,
        `member-${index}`,
      ),
      userId: ensureString(rawUserId, ''),
      telegramId: ensureString(rawTelegramId, ''),
      role,
      isCaptain: role === 'capitan',
      name: ensureString(user?.name, fallbackName),
      username: ensureString(user?.username, ''),
      phone: ensurePhone(user?.phone),
      userRole: ensureString(user?.role, ''),
      hasLinkedUser,
      photoUrl: ensureString(user?.photoUrl, ''),
      images: Array.isArray(user?.images) ? user.images : [],
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
      location: ensureString(game?.location, ''),
      dateStart: ensureDateISOString(game?.dateStart),
      hidden: ensureBoolean(game?.hidden, false),
    }))
    .sort((a, b) => {
      const dateA = a.dateStart ? new Date(a.dateStart).getTime() : 0
      const dateB = b.dateStart ? new Date(b.dateStart).getTime() : 0
      return dateB - dateA
    })
}

const resolvePlayedGamesCount = ({ team, normalizedGames }) => {
  const storedCount = Number(team?.gameStats?.playedGamesCount)
  if (Number.isFinite(storedCount) && storedCount >= 0) {
    return storedCount
  }

  return normalizedGames.reduce((acc, game) => {
    const status =
      typeof game?.status === 'string' ? game.status.trim().toLowerCase() : ''
    return status === 'closed' ? acc + 1 : acc
  }, 0)
}

const normalizeTeamForCabinet = ({ team, members, games, location = null }) => {
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
    image: ensureString(team?.image, ''),
    open: ensureBoolean(team?.open, true),
    location: ensureString(team?.location, ''),
    carSkin: normalizeTeamCarSkin(team?.carSkin),
    members: normalizedMembers,
    membersCount: normalizedMembers.length,
    captain,
    games: normalizedGames,
    gamesCount: resolvePlayedGamesCount({ team, normalizedGames }),
    rating: resolveEntityRating({ entity: team, location }),
    createdAt: ensureDateISOString(team?.createdAt),
    updatedAt: ensureDateISOString(team?.updatedAt),
  }
}

export default normalizeTeamForCabinet
