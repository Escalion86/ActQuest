import check from 'telegram/func/check'
import getTeamUser from 'telegram/func/getTeamUser'

const delTeamUserAdmin2 = async ({ telegramId, jsonCommand, location, db }) => {
  const checkData = check(jsonCommand, ['teamUserId'])
  if (checkData) return checkData

  const teamUser = await getTeamUser(jsonCommand.teamUserId, db)
  if (teamUser.success === false) return teamUser

  const user = await db
    .model('Users')
    .findOne({ telegramId: teamUser.userTelegramId })
  const team = await db.model('Teams').findById(teamUser.teamId)

  if (!jsonCommand.confirm) {
    return {
      success: true,
      message: `Подтвердите удаление участника "${user.name}" из команды "${team.name}"`,
      buttons: [
        {
          text: '\u{1F4A3} Удалить из команды',
          c: { confirm: true },
        },
        {
          text: '\u{1F6AB} Отмена',
          c: { c: 'userAdmin', userTId: teamUser.userTelegramId },
        },
      ],
    }
  }

  await db.model('TeamsUsers').findByIdAndDelete(jsonCommand.teamUserId)
  return {
    success: true,
    message: `Пользователь "${user.name}" удален из команды "${team.name}"`,
    nextCommand: { c: 'userAdmin', userTId: teamUser.userTelegramId },
  }
}

export default delTeamUserAdmin2
