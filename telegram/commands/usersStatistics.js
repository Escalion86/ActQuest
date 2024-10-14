import Games from '@models/Games'
import TeamsUsers from '@models/TeamsUsers'
import Users from '@models/Users'

import buttonListConstructor from 'telegram/func/buttonsListConstructor'
import formatGameName from 'telegram/func/formatGameName'

const usersStatistics = async ({ telegramId, jsonCommand }) => {
  const finishedGames = await Games.find({ status: 'finished' })
  // const users = await Users.find({})
  // const teamsUsers = await TeamsUsers.find({})

  // var allTeamsUsersInFinishedGames = []
  // games.forEach(({ result }) => {
  //   if (result) {
  //     allTeamsUsersInFinishedGames = [
  //       ...allTeamsUsersInFinishedGames,
  //       ...result.teamsUsers,
  //     ]
  //   }
  // })

  const page = jsonCommand?.page ?? 1
  const buttons = buttonListConstructor(finishedGames, page, (game, number) => {
    const gameId = String(game._id)
    const isChecked = jsonCommand.includes(gameId)
    return {
      text: `${isChecked ? `\u{2705}` : ''}${formatGameName(game)}`,
      c: {
        [gameId]: !isChecked,
      },
    }
  })

  return {
    message: `Выберите игры по которым необходимо показать рейтинг игроков`,
    buttons: [
      ...buttons,
      {
        c: { showStatistic: true },
        text: '\u{1F680} Показать результат',
      },
      {
        c: 'adminMenu',
        text: '\u{2B05} Назад',
      },
    ],
  }
}

export default usersStatistics
