import Games from '@models/Games'
import GamesTeams from '@models/GamesTeams'
import TeamsUsers from '@models/TeamsUsers'
import Users from '@models/Users'

import buttonListConstructor from 'telegram/func/buttonsListConstructor'
import formatGameName from 'telegram/func/formatGameName'

const placePoints = (place = 0) => {
  if (!place) return 0
  const points = 11 - place
  if (points < 0) return 0
  return points
}

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

    console.log('checkedGames :>> ', checkedGames)

    var usersStatistics = {}
    checkedGames.forEach(({ result }) => {
      const { teams, teamsUsers, gameTeams, teamsPlaces } = result
      if (!teamsPlaces || !teams) return
      teams.forEach(({ _id }) => {
        const id = String(_id)
        const usersTelegramIdsInTeam = teamsUsers
          .filter(({ teamId }) => teamId === id)
          .map(({ userTelegramId }) => userTelegramId)
        const teamPlace = teamsPlaces[id]
        const teamPoints = teamPlace ? placePoints(teamPlace) : 0
        if (teamPoints > 0) {
          usersTelegramIdsInTeam.forEach((userTelegramId) => {
            if (!usersStatistics[userTelegramId]) {
              usersStatistics[userTelegramId] = teamPoints
            } else {
              usersStatistics[userTelegramId] += teamPoints
            }
          })
        }
      })
    })
    const users = await Users.find({
      telegramId: { $in: Object.keys(usersStatistics) },
    })

    console.log('usersStatistics :>> ', usersStatistics)
    const usersWithPoints = users.map((user) => {
      const points = usersStatistics[user.telegramId] || 0
      return { ...user, points }
    })

    const sortedUsersWithPoints = usersWithPoints
      // .filter((user) => user.points > 0)
      .sort((a, b) => b.points - a.points)

    // const page2 = jsonCommand?.page ?? 1
    // const buttons = buttonListConstructor(sortedUsersWithPoints, page2, ({name, points}, number) => {
    //   return {
    //     text: `${number}. ${name} - ${points} очков`,
    //     c: {
    //       userTId: user,
    //     },
    //   }
    // })

    return {
      message: `Рейтинг игроков по выбранным играм:\n${sortedUsersWithPoints
        .map(({ name, points }, index) => {
          return `${index + 1}. ${name} - ${points} очков`
        })
        .join('\n')}`,
      buttons: [
        // ...buttons,
        {
          c: { showStatistic: false },
          text: '\u{21A9} Выбрать другие игры',
        },
        {
          c: 'adminMenu',
          text: '\u{2B05} Назад',
        },
      ],
    }
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
