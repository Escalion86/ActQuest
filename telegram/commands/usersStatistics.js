import { getNounPoints } from '@helpers/getNoun'
import Games from '@models/Games'
import GamesTeams from '@models/GamesTeams'
import TeamsUsers from '@models/TeamsUsers'
import Users from '@models/Users'

import buttonListConstructor from 'telegram/func/buttonsListConstructor'
import formatGameName from 'telegram/func/formatGameName'

const placePoints = (place) => {
  if (!place) return 0
  const points = 11 - place
  if (points < 0) return 0
  return points
}

const usersStatistics = async ({ telegramId, jsonCommand }) => {
  const finishedGames = await Games.find({ status: 'finished' }).lean()
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
    // const jsonKeys = Object.keys(jsonCommand)
    const checkedGames = finishedGames.filter(({ _id }) => {
      const gameId = String(_id)
      return jsonCommand[gameId]
    })

    var usersStatistics = {}
    checkedGames.forEach((game) => {
      if (!game?.result) return

      const { teams, teamsUsers, gameTeams, teamsPlaces } = game.result
      // console.log('teams.length :>> ', teams.length)
      // console.log('teamsPlaces :>> ', teamsPlaces)
      if (!teamsPlaces || !teams) return

      teams.forEach(({ _id, name }) => {
        const id = String(_id)
        const usersTelegramIdsInTeam = teamsUsers
          .filter(({ teamId }) => teamId === id)
          .map(({ userTelegramId }) => userTelegramId)
        const teamPlace = teamsPlaces[id]
        const teamPoints = teamPlace ? placePoints(teamPlace) : 0
        if (teamPoints > 0) {
          usersTelegramIdsInTeam.forEach((userTelegramId) => {
            if (!usersStatistics[userTelegramId]) {
              usersStatistics[userTelegramId] = [
                {
                  gameTitle: game.title,
                  teamName: name,
                  teamPlace,
                  teamPoints,
                },
              ]
            } else {
              usersStatistics[userTelegramId].push({
                gameTitle: game.title,
                teamName: name,
                teamPlace,
                teamPoints,
              })
            }
          })
        }
      })
    })
    const users = await Users.find({
      telegramId: { $in: Object.keys(usersStatistics).map((id) => Number(id)) },
    }).lean()

    const usersWithPoints = users.map((user) => {
      const pointsSum =
        usersStatistics[user.telegramId]?.length > 0
          ? usersStatistics[user.telegramId].reduce(
              (acc, { teamPoints }) => acc + teamPoints,
              0
            )
          : 0
      return {
        ...user,
        pointsSum,
        statistics: usersStatistics[user.telegramId],
      }
    })

    const sortedUsersWithPoints = usersWithPoints
      // .filter((user) => user.points > 0)
      .sort((a, b) => b.pointsSum - a.pointsSum)

    // const page2 = jsonCommand?.page ?? 1
    // const buttons = buttonListConstructor(sortedUsersWithPoints, page2, ({name, points}, number) => {
    //   return {
    //     text: `${number}. ${name} - ${points} очков`,
    //     c: {
    //       userTId: user,
    //     },
    //   }
    // })

    let place = 0
    let prevPointsSum = null

    return {
      message: `Рейтинг игроков по выбранным играм:\n${sortedUsersWithPoints
        .map(({ name, pointsSum, statistics }, index) => {
          if (prevPointsSum === null || prevPointsSum > pointsSum) {
            prevPointsSum = pointsSum
            place += 1
          }
          return `${place}. ${name} - ${getNounPoints(pointsSum)}${
            place <= 3
              ? `\n${statistics
                  .map(
                    ({ gameTitle, teamName, teamPlace, teamPoints }) =>
                      `${gameTitle} - ${teamName} - ${teamPlace} место - ${getNounPoints(
                        teamPoints
                      )}`
                  )
                  .join('\n')}`
              : ''
          }`
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
