const DEFAULT_GAME_MAP_RETURN_HREF = '/cabinet/games-upcoming'

const ALLOWED_GAMES_PATHS = new Set([
  '/cabinet/games',
  '/cabinet/games-upcoming',
  '/cabinet/games-past',
])

const NAVIGATION_ORIGIN = 'https://actquest.local'

const normalizeString = (value) => {
  const candidate = Array.isArray(value) ? value[0] : value
  return typeof candidate === 'string' ? candidate.trim() : ''
}

export const resolveGamesListPathByStatus = (statusValue) => {
  const status = normalizeString(statusValue).toLowerCase()

  return ['finished', 'closed', 'canceled'].includes(status)
    ? '/cabinet/games-past'
    : DEFAULT_GAME_MAP_RETURN_HREF
}

export const resolveGameMapReturnHref = (
  returnTo,
  fallbackHref = DEFAULT_GAME_MAP_RETURN_HREF,
) => {
  const normalizedFallback = normalizeString(fallbackHref)
  const safeFallback = ALLOWED_GAMES_PATHS.has(normalizedFallback)
    ? normalizedFallback
    : DEFAULT_GAME_MAP_RETURN_HREF
  const candidate = normalizeString(returnTo)

  if (!candidate) return safeFallback

  try {
    const url = new URL(candidate, NAVIGATION_ORIGIN)
    if (
      url.origin !== NAVIGATION_ORIGIN ||
      !ALLOWED_GAMES_PATHS.has(url.pathname)
    ) {
      return safeFallback
    }

    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return safeFallback
  }
}

export const buildGamesListReturnHref = ({
  pathname,
  searchParams,
  gameId,
  reopenTasks = false,
}) => {
  const baseHref = resolveGameMapReturnHref(pathname)
  const params = new URLSearchParams(
    typeof searchParams === 'string'
      ? searchParams
      : searchParams?.toString?.() || '',
  )

  params.delete('gameId')
  params.delete('open')

  const normalizedGameId = normalizeString(gameId)
  if (reopenTasks && normalizedGameId) {
    params.set('gameId', normalizedGameId)
    params.set('open', 'tasks')
  }

  const query = params.toString()
  return query ? `${baseHref}?${query}` : baseHref
}

export const buildGameMapHref = ({ gameId, returnTo }) => {
  const normalizedGameId = normalizeString(gameId)
  const baseHref = `/cabinet/admin/game-map/${encodeURIComponent(normalizedGameId)}`
  const params = new URLSearchParams()
  params.set('returnTo', resolveGameMapReturnHref(returnTo))

  return `${baseHref}?${params.toString()}`
}

