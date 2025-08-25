import userRole from '@helpers/userRole'
import userRoleName from '@helpers/userRoleName'
import check from 'telegram/func/check'

const userRoleChange = async ({ telegramId, jsonCommand, location, db }) => {
  const checkData = check(jsonCommand, ['userTId'])
  if (checkData) return checkData

  const user = await db
    .model('Users')
    .findOne({ telegramId: jsonCommand.userTId })
    .lean()

  const role = userRole(user)
  const roleName = userRoleName(user)

  if (!jsonCommand.role) {
    return {
      success: true,
      message: `Выберите роль пользователя "${user.name}"\n\nТекущая роль: ${roleName}\n\n<b>Виды ролей:</b>\n- Пользователь - обычный полозователь\n- Модератор - возможность создавать игры (редактировать только свои), отсутствует доступ к панели администратора\n- Администратор - полный контроль, а также доступ к панели администратора\n- Бан - пользователь забанен и не может участвовать в играх, создавать или присоединяться к командам. Доступ остается только на просмотр игр и их статистики`,
      buttons: [
        {
          text: '\u{26A1} Администратор',
          c: { role: 'admin' },
          hide: role === 'admin',
        },
        {
          text: '\u{26A1} Модератор',
          c: { role: 'moder' },
          hide: role === 'moder',
        },
        {
          text: '\u{26A1} Пользователь',
          c: { role: 'client' },
          hide: role === 'client',
        },
        {
          text: '\u{26A1} Бан',
          c: { role: 'ban' },
          hide: role === 'ban',
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
            text: '\u{26D4} Забанить',
            c: { role: 'ban', confirm: true },
          },
          {
            text: '\u{1F6AB} Отмена',
            c: { c: 'userAdmin', userTId: jsonCommand.userTId },
          },
        ],
      }
    } else {
      await db.model('Users').findByIdAndUpdate(user._id, { role: 'ban' })
      // Получаем список команд в которых присутствует пользователь
      const userTeams = await db
        .model('TeamsUsers')
        .find({ userTelegramId: jsonCommand.userTId })
        .lean()
      // Удаляем команды где забаненый пользователь является единственным в команде
      const deletedTeams = []
      for (const userTeam of userTeams) {
        const teamUsers = await db
          .model('TeamsUsers')
          .find({ teamId: userTeam.teamId })
          .lean()

        // Если пользователь является единственным в команде
        if (teamUsers.length === 1) {
          // Удаляем команду предварительно узнав название команды которую удаляем (для отображения списка)
          const team = await db.model('Teams').findById(userTeam.teamId).lean()
          deletedTeams.push(team.name)
          await db.model('Teams').deleteOne({ _id: userTeam.teamId })
        } else {
          // Если пользователей в команде более чем один, то поменяем роль капитана
          // Сначала находим капитана
          const teamUserOfUser = teamUsers.find(
            (u) => u.userTelegramId === jsonCommand.userTId
          )

          // Если пользователь является капитаном
          if (teamUserOfUser.role === 'captain') {
            // Поиск другого пользователя для передачи прав капитана
            const teamUserOfAnotherUser = teamUsers.find(
              (u) => u.userTelegramId !== jsonCommand.userTId
            )

            // Если пользователь найден
            if (teamUserOfAnotherUser) {
              // Передаем ему права капитана
              await db
                .model('TeamsUsers')
                .findByIdAndUpdate(teamUserOfAnotherUser._id, {
                  role: 'captain',
                })
            }
          }
        }
      }

      // Удаляем забаненного пользователя из всех команд
      await db
        .model('TeamsUsers')
        .deleteMany({ userTelegramId: jsonCommand.userTId })

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
