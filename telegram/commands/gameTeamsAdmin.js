import { getNounTeams } from '@helpers/getNoun'
import isUserAdmin from '@helpers/isUserAdmin'
import secondsToTimeStr from '@helpers/secondsToTimeStr'
import GamesTeams from '@models/GamesTeams'
import Teams from '@models/Teams'
import TeamsUsers from '@models/TeamsUsers'
import UsersGamesPayments from '@models/UsersGamesPayments'
// import dbConnect from '@utils/dbConnect'
import buttonListConstructor from 'telegram/func/buttonsListConstructor'
import check from 'telegram/func/check'
import formatGameName from 'telegram/func/formatGameName'
import getGame from 'telegram/func/getGame'

const gameTeamsAdmin = async ({ telegramId, jsonCommand, user }) => {
  const isAdmin = isUserAdmin(user)

  const checkData = check(jsonCommand, ['gameId'])
  if (checkData) return checkData

  const game = await getGame(jsonCommand?.gameId)
  if (game.success === false) return game

  const isGameStarted = game.status === 'started'
  const isGameFinished = game.status === 'finished'

  const gameTeams = await GamesTeams.find({ gameId: jsonCommand?.gameId })
    .lean()
    .sort({ createdAt: 1 })
  // if (!gameTeams || gameTeams.length === 0) {
  //   return {
  //     message: 'Никто не записался на игру',
  //     nextCommand: { c: 'editGameGeneral', gameId: jsonCommand?.gameId },
  //   }
  // }

  const teamsIds =
    gameTeams.length > 0
      ? gameTeams.map(
          (gameTeam) =>
            // mongoose.Types.ObjectId(teamUser.teamId)
            gameTeam.teamId
        )
      : []

  const teams =
    teamsIds.length > 0
      ? await Teams.find({
          _id: { $in: teamsIds },
        }).lean()
      : []

  const teamsUsers =
    teamsIds.length > 0
      ? await TeamsUsers.find({ teamId: { $in: teamsIds } }).lean()
      : []

  const usersTelegramIds = teamsUsers.map(
    (teamsUser) => teamsUser.userTelegramId
  )

  const paymentsOfUsers = await UsersGamesPayments.find({
    userTelegramId: { $in: usersTelegramIds },
    gameId: jsonCommand.gameId,
  }).lean()

  const sortedTeams = gameTeams.map(({ _id, teamId, timeAddings }) => {
    const team = teams.find(({ _id }) => String(_id) == teamId)
    const teamUsers = teamsUsers.filter(
      (teamUser) => teamUser.teamId === teamId
    )
    const teamUsersIds = teamUsers.map(({ userTelegramId }) => userTelegramId)
    const paymentsOfTeam = paymentsOfUsers.filter(({ userTelegramId }) =>
      teamUsersIds.includes(userTelegramId)
    )
    const sumOfPayments = paymentsOfTeam.reduce((acc, { sum }) => acc + sum, 0)
    const timeAdding =
      timeAddings?.length > 0
        ? timeAddings.reduce((acc, { time }) => {
            return acc + time
          }, 0)
        : undefined

    return { ...team, timeAdding, gameTeamId: _id, sumOfPayments, teamUsers }
  })

  const page = jsonCommand?.page ?? 1
  const buttons =
    sortedTeams.length > 0
      ? buttonListConstructor(
          sortedTeams,
          page,
          ({ timeAdding, gameTeamId, name, sumOfPayments }, number) => {
            return {
              text: `${number}. "${name}"${
                typeof timeAdding === 'number'
                  ? ` ${
                      timeAdding < 0 ? `\u{1F7E2}` : `\u{1F534}`
                    } ${secondsToTimeStr(Math.abs(timeAdding), true)}`
                  : ''
              }`,
              c: { c: 'gameTeamAdmin', gameTeamId },
            }
          }
        )
      : []

  return {
    message: `На игру <b>${formatGameName(
      game
    )}</b> зарегистрировано ${getNounTeams(sortedTeams.length)} (${
      teamsUsers.length
    } чел.)\n${sortedTeams
      .map(
        ({ name, teamUsers, sumOfPayments }, index) =>
          `\n${index + 1}. "${name}" (${
            teamUsers.length
          } чел.) - ${sumOfPayments} руб.`
      )
      .join('')}`,
    buttons: [
      ...buttons,
      {
        c: { c: 'selectTeamToJoinGameAdmin', gameId: jsonCommand.gameId },
        text: '\u{1F517} Зарегистрировать команду на игру',
        hide: !isAdmin || isGameStarted || isGameFinished,
      },
      {
        c: { c: 'editGameGeneral', gameId: jsonCommand?.gameId },
        text: '\u{2B05} Назад',
      },
    ],
  }
}

export default gameTeamsAdmin
