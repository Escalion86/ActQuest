import TeamsUsers from '@models/TeamsUsers'
// import dbConnect from '@utils/dbConnect'

const getTeamsUserOfUser = async (userTelegramId) => {
  // await dbConnect() // TODO: Нужно ли это?
  const teamsUser = await TeamsUsers.find({ userTelegramId: userTelegramId })

  return teamsUser
}

export default getTeamsUserOfUser
