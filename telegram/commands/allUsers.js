import buttonListConstructor from 'telegram/func/buttonsListConstructor'

const allUsers = async ({ telegramId, jsonCommand, location, db }) => {
  const users = await db.model('Users').find({})
  const teamsUsers = await db.model('TeamsUsers').find({})

  const games = await db.model('Games').find({})
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
        page: jsonCommand.page,
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
