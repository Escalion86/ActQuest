import Games from '@models/Games'
import GamesTeams from '@models/GamesTeams'
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

  if (jsonCommand.showStatistic) {
    const jsonKeys = Object.keys(jsonCommand)
    const checkedGames = finishedGames.filter(({ _id }) =>
      jsonKeys.includes(String(_id))
    )
    var allTeamsUsersInCheckedGames = []
    var usersStatistics = {}
    checkedGames.forEach(({ result }) => {
      if (result) {
        allTeamsUsersInCheckedGames = [
          ...allTeamsUsersInCheckedGames,
          ...result.teamsUsers,
        ]
      }
    })

    // const gamesIds = checkedGames.map(({ _id }) => String(_id))
    // const gamesTeams = await GamesTeams.find({
    //   gameId: { $in: gamesIds },
    // })
    // const teamsIds = gamesTeams.map(({ teamId }) => teamId)
    // const teamsUsers = await TeamsUsers.find({})
  }

  const page = jsonCommand?.page ?? 1
  const buttons = buttonListConstructor(finishedGames, page, (game, number) => {
    const gameId = String(game._id)
    const isChecked = jsonCommand[gameId]
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
