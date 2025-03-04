const getGameTeamsRegistredInAGame = async (gameId, db) => {
  const gameTeams = await db
    .model('GamesTeams')
    .find({
      gameId,
    })
    .lean()

  const teamsIds = gameTeams.map(
    (gameTeam) =>
      // mongoose.Types.ObjectId(teamUser.teamId)
      gameTeam.teamId
  )

  const teams = await db
    .model('Teams')
    .find({
      _id: { $in: teamsIds },
    })
    .lean()
  if (!teams || teams.length === 0) return []

  return teams
}

export default getGameTeamsRegistredInAGame
