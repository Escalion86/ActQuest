import TeamsUsers from '@models/TeamsUsers'
import Users from '@models/Users'
import dbConnect from '@utils/dbConnect'
import buttonListConstructor from 'telegram/func/buttonsListConstructor'

const users = async ({ telegramId, jsonCommand }) => {
  await dbConnect()
  const users = await Users.find({})
  const teamsUsers = await TeamsUsers.find({})

  const usersWithNoTeam = users.filter(
    (user) =>
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
      text: `${number}. ${user.name}`,
      c: {
        c: 'userAdmin',
        userTId: user.telegramId,
        // p: 1,
      },
    })
  )

  return {
    message: `<b>Пользователи без команды</b>: ${usersWithNoTeam.length} чел.`,
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
