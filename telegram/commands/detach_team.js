import TeamsUsers from '@models/TeamsUsers'
import getTeamUser from 'telegram/func/getTeamUser'

const detach_team = async ({ telegramId, jsonCommand }) => {
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

  if (!jsonCommand.confirm) {
    return {
      success: true,
      message: 'Подтвердите удаление участника из команды',
      buttons: [
        {
          text: '\u{1F4A3} Удалить из команды',
          command: { confirm: true },
        },
        { text: '\u{1F6AB} Отмена', command: 'menu_teams' },
      ],
    }
  }

  await TeamsUsers.findByIdAndDelete(jsonCommand.teamUserId)
  return {
    success: true,
    message: 'Пользователь удален из команды',
    nextCommand: `menu_teams`,
  }
}

export default detach_team
