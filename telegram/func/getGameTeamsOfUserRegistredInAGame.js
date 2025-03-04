const getGameTeamsOfUserRegistredInAGame = async (
  userTelegramId,
  gameId,
  db
) => {
  const teamsUser = await db
    .model('TeamsUsers')
    .find({ userTelegramId: userTelegramId })
  if (!teamsUser || teamsUser.length === 0) return []

  const teamsIds = teamsUser.map(
    (teamUser) =>
      // mongoose.Types.ObjectId(teamUser.teamId)
      teamUser.teamId
  )

  const teams = await db
    .model('Teams')
    .find({
      _id: { $in: teamsIds },
    })
    .lean()
  if (!teams || teams.length === 0) return []

  const gameTeams = await db
    .model('GamesTeams')
    .find({
      teamId: { $in: teamsIds },
      gameId,
    })
    .lean()

  return gameTeams
}

export default getGameTeamsOfUserRegistredInAGame
