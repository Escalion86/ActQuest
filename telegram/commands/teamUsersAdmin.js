import buttonListConstructor from 'telegram/func/buttonsListConstructor'
import check from 'telegram/func/check'
import getTeam from 'telegram/func/getTeam'

const teamUsersAdmin = async ({ telegramId, jsonCommand, location, db }) => {
  const checkData = check(jsonCommand, ['teamId'])
  if (checkData) return checkData

  const team = await getTeam(jsonCommand?.teamId, db)
  if (team.success === false) return team

  const teamsUsers = await db
    .model('TeamsUsers')
    .find({ teamId: jsonCommand?.teamId })
  if (!teamsUsers || teamsUsers.length === 0) {
    return {
      message: 'Никто не состоит в команде',
      nextCommand: {
        c: 'teams',
        teamId: jsonCommand.teamId,
        page: jsonCommand.page,
      },
    }
  }

  const usersTelegramIds = teamsUsers.map(
    (teamUser) =>
      // mongoose.Types.ObjectId(teamUser.teamId)
      teamUser.userTelegramId
  )

  const users = await db.model('Users').find({
    telegramId: { $in: usersTelegramIds },
  })

  const usersWithRoleInTeam = users.map((user) => {
    const teamUser = teamsUsers.find((teamUser) => {
      return teamUser.userTelegramId === user.telegramId
    })
    return { name: user.name, role: teamUser?.role, teamUserId: teamUser._id }
  })
  usersWithRoleInTeam.sort((user) => (user?.role === 'capitan' ? -1 : 1))

  const page2 = jsonCommand?.page2 ?? 1
  const buttons = buttonListConstructor(
    usersWithRoleInTeam,
    page2,
    ({ name, role, teamUserId }, number) => ({
      text: `${number}. ${name}${role === 'capitan' ? ' (капитан)' : ''}`,
      c: { c: 'teamUserAdmin', teamUserId: teamUserId, page: jsonCommand.page },
    })
  )

  return {
    message: `<b>АДМИНИСТРИРОВАНИЕ</b>\n\n<b>Состав команды "${team.name}"</b>`,
    buttons: [
      ...buttons,
      {
        c: {
          c: 'editTeamAdmin',
          teamId: jsonCommand.teamId,
          page: jsonCommand.page,
        },
        text: '\u{2B05} Назад',
      },
    ],
  }
}

export default teamUsersAdmin
