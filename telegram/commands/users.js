import userRole from '@helpers/userRole'
import userRoleName from '@helpers/userRoleName'
import buttonListConstructor from 'telegram/func/buttonsListConstructor'

const users = async ({ telegramId, jsonCommand, location, db }) => {
  const users = await db.model('Users').find({})
  const teamsUsers = await db.model('TeamsUsers').find({})

  const usersWithNoTeam = users.filter(
    (user) =>
      userRole(user) !== 'ban' &&
      !teamsUsers.find(
        (teamUser) => teamUser.userTelegramId === user.telegramId
      )
  )

  if (!usersWithNoTeam || usersWithNoTeam.length === 0) {
    return {
      message: 'Нет пользователей неприсоединенных к какой-либо команде',
      nextCommand: `mainMenu`,
    }
  }

  const page = jsonCommand?.page ?? 1
  const buttons = buttonListConstructor(
    usersWithNoTeam,
    page,
    (user, number) => ({
      text: `${number}. ${user.name}${
        userRole(user) !== 'client' ? ` (${userRoleName(user)})` : ''
      }`,
      c: {
        c: 'userAdmin',
        userTId: user.telegramId,
        // p: 1,
      },
    })
  )

  return {
    message: `<b>Пользователи без команды</b>: ${usersWithNoTeam.length} чел. (в списке нет забаненых пользователей)`,
    buttons: [
      ...buttons,
      {
        c: 'adminMenu',
        text: '\u{2B05} Назад',
      },
    ],
  }
}

export default users
