import GamesTeams from '@models/GamesTeams'
import Teams from '@models/Teams'
import TeamsUsers from '@models/TeamsUsers'

const getTeamOfUserRegistredInAGame = async (userTelegramId, gameId) => {
  const teamsUser = await TeamsUsers.find({
    userTelegramId: userTelegramId,
  }).lean()
  if (!teamsUser || teamsUser.length === 0) return []

  const teamsIds = teamsUser.map(
    (teamUser) =>
      // mongoose.Types.ObjectId(teamUser.teamId)
      teamUser.teamId
  )

  const teams = await Teams.find({
    _id: { $in: teamsIds },
  }).lean()
  if (!teams || teams.length === 0) return []

  const gameTeams = await GamesTeams.find({
    teamId: { $in: teamsIds },
    gameId,
  }).lean()
  if (!gameTeams || gameTeams.length === 0) return []

  const registredTeams = gameTeams.map((gameTeam) =>
    teams.find((team) => String(team._id) === gameTeam.teamId)
  )
  return registredTeams
}

export default getTeamOfUserRegistredInAGame
