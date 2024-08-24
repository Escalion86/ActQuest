import Teams from '@models/Teams'
import TeamsUsers from '@models/TeamsUsers'
// import dbConnect from '@utils/dbConnect'

const getTeamsOfUser = async (userTelegramId) => {
  const teamsUser = await TeamsUsers.find({ userTelegramId: userTelegramId })
  if (!teamsUser || teamsUser.length === 0) return []

  const teamsIds = teamsUser.map(
    (teamUser) =>
      // mongoose.Types.ObjectId(teamUser.teamId)
      teamUser.teamId
  )

  const teams = await Teams.find({
    _id: { $in: teamsIds },
  })

  return teams
}

export default getTeamsOfUser
