import TeamsUsers from '@models/TeamsUsers'
import Users from '@models/Users'
import dbConnect from '@utils/dbConnect'
import getTeam from 'telegram/func/getTeam'

const team_users = async ({ telegramId, jsonCommand }) => {
  if (!jsonCommand?.teamId)
    return {
      message: 'Ошибка. Не указан teamId',
      nextCommand: `menu_teams`,
    }

  const team = await getTeam(jsonCommand?.teamId)
  if (!team || team.length === 0) {
    return {
      message: 'Ошибка. Команда не найдена',
      nextCommand: `menu_teams`,
    }
  }

  await dbConnect()
  const teamsUsers = await TeamsUsers.find({ teamId: jsonCommand?.teamId })
  if (!teamsUsers || teamsUsers.length === 0) {
    return {
      message: 'Никто не состоит в команде',
      nextCommand: `menu_teams`,
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
  const buttons = users.map((user) => {
    const teamUser = teamsUsers.find((teamUser) => {
      return teamUser.userTelegramId === user.telegramId
    })
    // const role = teamUser.role === 'capitan' ? 'Капитан' : 'Участник'
    return {
      text: `${user.name}${teamUser?.role === 'capitan' ? ' (Капитан)' : ''}`,
      cmd: { cmd: 'team_user', teamUserId: teamUser._id },
      // `team_user/teamUserId=${teamUser._id}`,
    }
  })

  return {
    message: `Состав команды "${team.name}"`,
    buttons: [...buttons, { cmd: 'menu_teams', text: '\u{2B05} Назад' }],
  }
}

export default team_users
