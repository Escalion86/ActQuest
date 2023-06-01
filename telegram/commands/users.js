import TeamsUsers from '@models/TeamsUsers'
import Users from '@models/Users'
import dbConnect from '@utils/dbConnect'

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

  return {
    message: '<b>Обзор пользователей без команды</b>',
    buttons: [
      ...usersWithNoTeam.map((user) => {
        return {
          text: user.name,
          c: {
            c: 'userAdmin',
            userTId: user.telegramId,
            // p: 1,
          },
        }
      }),
      {
        c: 'mainMenu',
        text: '\u{2B05} Назад',
      },
    ],
  }
}

export default users
