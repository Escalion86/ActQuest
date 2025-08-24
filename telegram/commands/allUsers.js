import userRole from '@helpers/userRole'
import buttonListConstructor from 'telegram/func/buttonsListConstructor'

const allUsers = async ({ telegramId, jsonCommand, location, db }) => {
  const users = await db.model('Users').find({}).lean()
  const teamsUsers = await db.model('TeamsUsers').find({}).lean()
  const games = await db.model('Games').find({}).lean()

  var allTeamsUsersInFinishedGames = []
  games.forEach(({ result }) => {
    if (result) {
      allTeamsUsersInFinishedGames = [
        ...allTeamsUsersInFinishedGames,
        ...result.teamsUsers,
      ]
    }
  })

  const filteredUsers = users.filter((user) => {
    switch (userRole(user)) {
      case 'client':
        return jsonCommand.showClients
      case 'admin':
        return jsonCommand.showAdmin
      case 'ban':
        return jsonCommand.showBan
      default:
        return false
    }
  })

  const page = jsonCommand?.page ?? 1
  const buttons = buttonListConstructor(filteredUsers, page, (user, number) => {
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
        page: jsonCommand.page,
        // p: 1,
      },
    }
  })

  return {
    message: `<b>Все пользователи согласно фильтру (${filteredUsers.length} чел.)\nВ скобках указано количество команд / сыграных игр</b>`,
    buttons: [
      [
        {
          c: {
            showClients: !jsonCommand.showClients,
            page: 1,
          },
          text: (jsonCommand.showClients ? '✅' : '❌') + ' Пользователи',
        },
        {
          c: {
            showAdmin: !jsonCommand.showAdmin,
            page: 1,
          },
          text: (jsonCommand.showAdmin ? '✅' : '❌') + ' Админы',
        },
        {
          c: {
            showBan: !jsonCommand.showBan,
            page: 1,
          },
          text: (jsonCommand.showBan ? '✅' : '❌') + ' Бан',
        },
      ],
      ...buttons,
      {
        c: 'adminMenu',
        text: '\u{2B05} Назад',
      },
    ],
  }
}

export default allUsers
