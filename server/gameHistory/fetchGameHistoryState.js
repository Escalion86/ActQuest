const fetchGameHistoryState = async ({ db, gameId, game = null } = {}) => {
  if (!db || !gameId) {
    return { game: null, gameTeams: [] }
  }

  const Games = db.model('Games')
  const GamesTeams = db.model('GamesTeams')

  const resolvedGame =
    game ||
    (await Games.findById(gameId)
      .lean()
      .catch(() => null))

  const gameTeams = await GamesTeams.find({ gameId }).lean().catch(() => [])

  return {
    game: resolvedGame || null,
    gameTeams: Array.isArray(gameTeams) ? gameTeams : [],
  }
}

export default fetchGameHistoryState
