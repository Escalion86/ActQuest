import Users from '@models/Users'
import dbConnect from '@utils/dbConnect'
import getTeam from 'telegram/func/getTeam'
import getTeamUser from 'telegram/func/getTeamUser'

const team_user = async ({ telegramId, jsonCommand }) => {
  if (!jsonCommand?.teamUserId)
    return {
      message: 'Ошибка. Не указан teamUserId',
      nextCommand: `menu_teams`,
    }

  const teamUser = await getTeamUser(jsonCommand.teamUserId)
  if (!teamUser || teamUser.length === 0) {
    return {
      message: 'Ошибка. Не найдена регистрация участника в команде',
      nextCommand: `menu_teams`,
    }
  }
  const isCapitan = teamUser.role === 'capitan'

  const team = await getTeam(teamUser.teamId)
  if (!team || team.length === 0) {
    return {
      message: 'Ошибка. Не найдена команда привязанная к регистрации участника',
      nextCommand: `menu_teams`,
    }
  }

  await dbConnect()
  const user = await Users.findOne({
    telegramId: teamUser.userTelegramId,
  })
  if (!user || user.length === 0) {
    return {
      message: 'Ошибка. Не найден пользователь привязанный к команде',
      nextCommand: `menu_teams`,
    }
  }

  const buttons = isCapitan
    ? [
        {
          cmd: {
            cmd: 'detach_team',
            teamUserId: jsonCommand.teamUserId,
          },
          //`detach_team/teamUserId=${jsonCommand.teamUserId}`,
          text: '\u{1F4A3} Удалить из команды',
        },
        { cmd: 'menu_teams', text: '\u{2B05} Назад' },
      ]
    : [{ cmd: 'menu_teams', text: '\u{2B05} Назад' }]

  return {
    message: `"${user.name}" ${isCapitan ? 'капитан' : 'участник'} команды "${
      team.name
    }"`,
    buttons,
  }
}

export default team_user
