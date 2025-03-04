const getUsersOfTeamWithRole = async (id, db) => {
  const teamUsers = await db
    .model('TeamsUsers')
    .find({
      teamId: id,
    })
    .lean()

  const usersTelegramIds = teamUsers.map((teamUser) => teamUser.userTelegramId)

  const users = await db
    .model('Users')
    .find({
      telegramId: { $in: usersTelegramIds },
    })
    .lean()

  // const capitanTelegramId = teamUsers.find(
  //   (teamUser) => teamUser.role === 'capitan'
  // )?.userTelegramId

  const usersWithRole = users.map((user) => {
    const teamUser = teamUsers.find((teamUser) => {
      return teamUser.userTelegramId === user.telegramId
    })
    return { ...user, role: teamUser?.role, teamUserId: teamUser._id }
  })

  return usersWithRole
}
export default getUsersOfTeamWithRole
