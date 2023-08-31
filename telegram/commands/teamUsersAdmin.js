import TeamsUsers from '@models/TeamsUsers'
import Users from '@models/Users'
import dbConnect from '@utils/dbConnect'
import buttonListConstructor from 'telegram/func/buttonsListConstructor'
import check from 'telegram/func/check'
import getTeam from 'telegram/func/getTeam'

const teamUsersAdmin = async ({ telegramId, jsonCommand }) => {
  const checkData = check(jsonCommand, ['teamId'])
  if (checkData) return checkData

  const team = await getTeam(jsonCommand?.teamId)
  if (team.success === false) return team

  await dbConnect()
  const teamsUsers = await TeamsUsers.find({ teamId: jsonCommand?.teamId })
  if (!teamsUsers || teamsUsers.length === 0) {
    return {
      message: 'Никто не состоит в команде',
      nextCommand: { c: 'teams', teamId: jsonCommand.teamId },
    }
  }

  const usersTelegramIds = teamsUsers.map(
    (teamUser) =>
      // mongoose.Types.ObjectId(teamUser.teamId)
      teamUser.userTelegramId
  )

  const users = await Users.find({
    telegramId: { $in: usersTelegramIds },
  })

  const usersWithRoleInTeam = users.map((user) => {
    const teamUser = teamsUsers.find((teamUser) => {
      return teamUser.userTelegramId === user.telegramId
    })
    return { ...user, role: teamUser?.role, teamUserId: teamUser._id }
  })
  usersWithRoleInTeam.sort((user) => (user?.role === 'capitan' ? -1 : 1))
  console.log('usersWithRoleInTeam :>> ', usersWithRoleInTeam)

  const page = jsonCommand?.page ?? 1
  const buttons = buttonListConstructor(
    usersWithRoleInTeam,
    page,
    (user, number) => ({
      text: `${number}. ${user.name}${
        user.role === 'capitan' ? ' (капитан)' : ''
      }`,
      c: { c: 'teamUserAdmin', teamUserId: user.teamUserId },
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
        },
        text: '\u{2B05} Назад',
      },
    ],
  }
}

export default teamUsersAdmin
