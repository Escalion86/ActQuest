import TeamsUsers from '@models/TeamsUsers'
import check from 'telegram/func/check'
import getTeamUser from 'telegram/func/getTeamUser'

const delTeamUserAdmin = async ({ telegramId, jsonCommand }) => {
  const checkData = check(jsonCommand, ['teamUserId'])
  if (checkData) return checkData

  const teamUser = await getTeamUser(jsonCommand.teamUserId)
  if (teamUser.success === false) return teamUser

  if (!jsonCommand.confirm) {
    return {
      success: true,
      message: 'Подтвердите удаление участника из команды',
      buttons: [
        {
          text: '\u{1F4A3} Удалить из команды',
          c: { confirm: true },
        },
        {
          text: '\u{1F6AB} Отмена',
          c: {
            c: 'teamUsersAdmin',
            teamUserId: jsonCommand.teamUserId,
            page: jsonCommand.page,
          },
        },
      ],
    }
  }

  await TeamsUsers.findByIdAndDelete(jsonCommand.teamUserId)
  return {
    success: true,
    message: 'Пользователь удален из команды',
    nextCommand: {
      c: 'teamUsersAdmin',
      teamId: teamUser.teamId,
      page: jsonCommand.page,
    },
  }
}

export default delTeamUserAdmin
