import userRoleName from '@helpers/userRoleName'
import check from 'telegram/func/check'

const userRoleChange = async ({ telegramId, jsonCommand, location, db }) => {
  const checkData = check(jsonCommand, ['userTId'])
  if (checkData) return checkData

  const user = await db
    .model('Users')
    .findOne({ telegramId: jsonCommand.userTId })
    .lean()

  const roleName = userRoleName(user)

  if (!jsonCommand.role) {
    return {
      success: true,
      message: `Выберите роль пользователя "${user.name}"\n\nТекущая роль: ${roleName}`,
      buttons: [
        {
          text: '\u{26A1} Администратор',
          c: { role: 'admin' },
          hide: roleName === 'Администратор',
        },
        {
          text: '\u{26A1} Пользователь',
          c: { role: 'client' },
          hide: roleName === 'Пользователь',
        },
        {
          text: '\u{26A1} Бан',
          c: { role: 'ban' },
          hide: roleName === 'Бан',
        },
        {
          text: '\u{1F6AB} Отмена',
          c: { c: 'userAdmin', userTId: jsonCommand.userTId },
        },
      ],
    }
  }

  if (jsonCommand.role === 'ban') {
    if (!jsonCommand.confirm) {
      return {
        success: true,
        message: `Вы действительно хотите забанить пользователя "${user.name}"?\n\nТакже это удалит его со всех команд в которых он состоит (сами команды останутся нетронутыми, если в них есть еще пользователи)!`,
        buttons: [
          {
            text: '\u{1F6AB} Отмена',
            c: { c: 'userAdmin', userTId: jsonCommand.userTId },
          },
          {
            text: '\u{1F6AB} Забанить',
            c: { role: 'ban', confirm: true },
          },
        ],
      }
    } else {
      await db.model('Users').findByIdAndUpdate(user._id, { role: 'ban' })
      // Получаем список команд в которых присутствует пользователь
      const userTeams = await db
        .model('TeamsUsers')
        .find({ userTelegramId: telegramId })
        .lean()
      // Удаляем команды где забаненый пользователь является единственным в команде
      const deletedTeams = []
      for (const userTeam of userTeams) {
        const teamUsers = await db
          .model('TeamsUsers')
          .find({ teamId: userTeam.teamId })
          .lean()
        if (teamUsers.length === 1) {
          const team = await db.model('Teams').findOne({ _id: userTeam.teamId })
          deletedTeams.push(team.name)
          await db.model('Teams').deleteOne({ _id: userTeam.teamId })
        }
      }

      return {
        success: true,
        message: `Пользователь "${user.name}" забанен!${
          deletedTeams.length > 0
            ? `\n\n${
                deletedTeams.length === 1
                  ? `Команда "${deletedTeams[0]}" удалена`
                  : `Команды "${deletedTeams.join('", "')}" удалены`
              }`
            : ''
        }`,
        nextCommand: { c: 'userAdmin', userTId: jsonCommand.userTId },
      }
    }
  }

  await db
    .model('Users')
    .findByIdAndUpdate(user._id, { role: jsonCommand.role })

  return {
    success: true,
    message: `Роль пользователя "${user.name}" изменена на "${userRoleName({
      role: jsonCommand.role,
    })}"`,
    nextCommand: { c: 'userAdmin', userTId: jsonCommand.userTId },
  }
}

export default userRoleChange
