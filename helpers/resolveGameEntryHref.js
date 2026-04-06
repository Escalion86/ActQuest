const normalizeValue = (value) =>
  value === null || value === undefined ? '' : String(value).trim()

export const resolveGameEntryHref = ({
  gameId,
  teamId,
  fallbackGameListPath = '/cabinet/games-upcoming',
}) => {
  const normalizedGameId = normalizeValue(gameId)
  if (!normalizedGameId) {
    return fallbackGameListPath
  }

  const normalizedTeamId = normalizeValue(teamId)

  if (normalizedTeamId) {
    return `/game/${encodeURIComponent(normalizedGameId)}/process/${encodeURIComponent(normalizedTeamId)}`
  }

  return `${fallbackGameListPath}?gameId=${encodeURIComponent(normalizedGameId)}`
}

export const resolveGameEntryHrefFromGame = ({
  game,
  fallbackGameListPath = '/cabinet/games-upcoming',
}) => {
  const normalizedGameId = normalizeValue(game?.id)
  const firstTeamId =
    Array.isArray(game?.userParticipationTeams) &&
    game.userParticipationTeams.length > 0
      ? normalizeValue(game.userParticipationTeams[0]?.teamId)
      : ''

  if (!normalizedGameId || !firstTeamId) {
    return null
  }

  return resolveGameEntryHref({
    gameId: normalizedGameId,
    teamId: firstTeamId,
    fallbackGameListPath,
  })
}
