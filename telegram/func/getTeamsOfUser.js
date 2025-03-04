const getTeamsOfUser = async (userTelegramId, db) => {
  const teamsUser = await db
    .model('TeamsUsers')
    .find({
      userTelegramId: userTelegramId,
    })
    .lean()
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

  return teams
}

export default getTeamsOfUser
