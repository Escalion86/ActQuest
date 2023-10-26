import Games from '@models/Games'
import TeamsUsers from '@models/TeamsUsers'
import Users from '@models/Users'
import dbConnect from '@utils/dbConnect'
import buttonListConstructor from 'telegram/func/buttonsListConstructor'

const allUsers = async ({ telegramId, jsonCommand }) => {
  await dbConnect()
  const users = await Users.find({})
  const teamsUsers = await TeamsUsers.find({})

  const games = await Games.find({})
  var allTeamsUsersInFinishedGames = []
  games.forEach(({ result }) => {
    if (result) {
      allTeamsUsersInFinishedGames = [
        ...allTeamsUsersInFinishedGames,
        ...result.teamsUsers,
      ]
    }
  })

  const page = jsonCommand?.page ?? 1
  const buttons = buttonListConstructor(
    usersWithNoTeam,
    page,
    (user, number) => {
      const finishedGamesCount = allTeamsUsersInFinishedGames.filter(
        ({ userTelegramId }) => userTelegramId === user.telegramId
      ).length
      return {
        text: `${number}. ${user.name} (${finishedGamesCount})`,
        c: {
          c: 'userAdmin',
          userTId: user.telegramId,
          // p: 1,
        },
      }
    }
  )

  return {
    message:
      '<b>Обзор всех пользователей.\nВ скобках указано количество сыграных игр</b>',
    buttons: [
      ...buttons,
      {
        c: 'mainMenu',
        text: '\u{2B05} Назад',
      },
    ],
  }
}

export default allUsers
