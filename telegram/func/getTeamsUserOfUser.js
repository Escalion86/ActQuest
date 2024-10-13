import TeamsUsers from '@models/TeamsUsers'

const getTeamsUserOfUser = async (userTelegramId) => {
  const teamsUser = await TeamsUsers.find({
    userTelegramId: userTelegramId,
  }).lean()

  return teamsUser
}

export default getTeamsUserOfUser
