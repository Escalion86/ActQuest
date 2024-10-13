import GamesTeams from '@models/GamesTeams'
import Teams from '@models/Teams'

const getGameTeamsRegistredInAGame = async (gameId) => {
  const gameTeams = await GamesTeams.find({
    gameId,
  }).lean()

  const teamsIds = gameTeams.map(
    (gameTeam) =>
      // mongoose.Types.ObjectId(teamUser.teamId)
      gameTeam.teamId
  )

  const teams = await Teams.find({
    _id: { $in: teamsIds },
  }).lean()
  if (!teams || teams.length === 0) return []

  return teams
}

export default getGameTeamsRegistredInAGame
