import TeamsUsers from '@models/TeamsUsers'
import Users from '@models/Users'
import dbConnect from '@utils/dbConnect'
import getTeam from 'telegram/func/getTeam'
import getTeamUser from 'telegram/func/getTeamUser'

const team_user = async ({ telegramId, message, props }) => {
  if (!props?.teamUserId)
    return {
      message: 'Ошибка. Не указан teamUserId',
      nextCommand: `/menu_teams`,
    }

  const teamUser = await getTeamUser(props.teamUserId)
  if (!teamUser || teamUser.length === 0) {
    return {
      message: 'Ошибка. Не найдена регистрация участника в команде',
      nextCommand: `/menu_teams`,
    }
  }
  const isCapitan = teamUser.role === 'capitan'

  const team = await getTeam(teamUser.teamId)
  if (!team || team.length === 0) {
    return {
      message: 'Ошибка. Не найдена команда привязанная к регистрации участника',
      nextCommand: `/menu_teams`,
    }
  }

  await dbConnect()
  const user = await Users.findOne({
    telegramId: teamUser.userTelegramId,
  })
  if (!user || user.length === 0) {
    return {
      message: 'Ошибка. Не найден пользователь привязанный к команде',
      nextCommand: `/menu_teams`,
    }
  }

  return {
    message: `"${user.name}" ${isCapitan ? 'капитан' : 'участник'} команды "${
      team.name
    }"`,
    buttons: [
      {
        command: `detach_team/teamUserId=${props.teamUserId}`,
        text: 'Удалить из команды',
      },
      { command: 'menu_teams', text: '\u{2B05} Назад' },
    ],
  }
}

export default team_user
