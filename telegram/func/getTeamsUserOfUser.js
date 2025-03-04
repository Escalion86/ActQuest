const getTeamsUserOfUser = async (userTelegramId, db) => {
  const teamsUser = await db
    .model('TeamsUsers')
    .find({
      userTelegramId: userTelegramId,
    })
    .lean()

  return teamsUser
}

export default getTeamsUserOfUser
