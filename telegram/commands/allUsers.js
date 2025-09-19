import userRole from '@helpers/userRole'
import userRoleName from '@helpers/userRoleName'
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

  const countUsers = {
    client: 0,
    admin: 0,
    ban: 0,
    moder: 0,
  }

  const filteredUsers = users.filter((user) => {
    switch (userRole(user)) {
      case 'client':
        countUsers.client++
        return !jsonCommand.hideClients
      case 'admin':
        countUsers.admin++
        return !jsonCommand.hideAdmin
      case 'ban':
        countUsers.ban++
        return !jsonCommand.hideBan
      case 'moder':
        countUsers.moder++
        return !jsonCommand.hideModer
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
      text: `${number}. ${
        user.name
      } (${teamsOfUserCount}/${finishedGamesCount})${
        userRole(user) !== 'client' ? ` (${userRoleName(user)})` : ''
      }`,
      c: {
        c: 'userAdmin',
        userTId: user.telegramId,
        page: jsonCommand.page,
        // p: 1,
      },
    }
  })

  return {
    message: `<b>Все пользователи согласно фильтру</b> (${filteredUsers.length} чел.)\n\n<i>Примечание: в скобках указано количество команд / сыграных игр</i>`,
    buttons: [
      [
        {
          c: {
            hideClients: !jsonCommand.hideClients,
            page: 1,
          },
          text:
            (jsonCommand.hideClients ? '❌' : '✅') +
            ` Пользователи (${countUsers.client})`,
        },

        {
          c: {
            hideBan: !jsonCommand.hideBan,
            page: 1,
          },
          text:
            (jsonCommand.hideBan ? '❌' : '✅') + ` Бан (${countUsers.ban})`,
        },
      ],
      [
        {
          c: {
            hideModer: !jsonCommand.hideModer,
            page: 1,
          },
          text:
            (jsonCommand.hideModer ? '❌' : '✅') +
            ` Модераторы (${countUsers.moder})`,
        },
        {
          c: {
            hideAdmin: !jsonCommand.hideAdmin,
            page: 1,
          },
          text:
            (jsonCommand.hideAdmin ? '❌' : '✅') +
            ` Админы (${countUsers.admin})`,
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
