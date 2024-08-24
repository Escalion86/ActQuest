import Games from '@models/Games'
import TeamsUsers from '@models/TeamsUsers'
import Users from '@models/Users'
// import dbConnect from '@utils/dbConnect'
import buttonListConstructor from 'telegram/func/buttonsListConstructor'

const allUsers = async ({ telegramId, jsonCommand }) => {
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
  const buttons = buttonListConstructor(users, page, (user, number) => {
    const teamsOfUserCount = teamsUsers.filter(
      (teamsUser) => teamsUser.userTelegramId === user.telegramId
    ).length
    const finishedGamesCount = allTeamsUsersInFinishedGames.filter(
      ({ userTelegramId }) => userTelegramId === user.telegramId
    ).length
    return {
      text: `${number}. ${user.name} (${teamsOfUserCount}/${finishedGamesCount})`,
      c: {
        c: 'userAdmin',
        userTId: user.telegramId,
        // p: 1,
      },
    }
  })

  return {
    message: `<b>Обзор всех пользователей (${users.length} чел.)\nВ скобках указано количество команд / сыграных игр</b>`,
    buttons: [
      ...buttons,
      {
        c: 'adminMenu',
        text: '\u{2B05} Назад',
      },
    ],
  }
}

export default allUsers
