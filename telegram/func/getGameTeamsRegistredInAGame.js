import GamesTeams from '@models/GamesTeams'
import Teams from '@models/Teams'
// import dbConnect from '@utils/dbConnect'

const getGameTeamsRegistredInAGame = async (gameId) => {
  // await dbConnect() // TODO: Нужно ли это?
  const gameTeams = await GamesTeams.find({
    gameId,
  })

  const teamsIds = gameTeams.map(
    (gameTeam) =>
      // mongoose.Types.ObjectId(teamUser.teamId)
      gameTeam.teamId
  )

  const teams = await Teams.find({
    _id: { $in: teamsIds },
  })
  if (!teams || teams.length === 0) return []

  return teams
}

export default getGameTeamsRegistredInAGame
