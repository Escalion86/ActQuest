import TeamsUsers from '@models/TeamsUsers'
import getTeamUser from 'telegram/func/getTeamUser'

const detach_team = async ({ telegramId, message, props }) => {
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

  if (!props.confirm) {
    props.confirm = 'true'
    return {
      success: true,
      message: 'Подтвердите удаление участника из команды',
      buttons: [
        {
          text: 'Удалить',
          command: `+confirm=true`,
          // `delete_team` + propsToStr(props)
        },
        { text: 'Отмена', command: 'menu_teams' },
      ],
    }
  }

  await TeamsUsers.findByIdAndDelete(props.teamUserId)
  return {
    success: true,
    message: 'Пользователь удален из команды',
    nextCommand: `/menu_teams`,
  }
}

export default detach_team
