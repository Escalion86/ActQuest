import { getNounTeams } from '@helpers/getNoun'
import GamesTeams from '@models/GamesTeams'
import Teams from '@models/Teams'
import TeamsUsers from '@models/TeamsUsers'
import { ADMIN_TELEGRAM_IDS } from 'telegram/constants'
// import dbConnect from '@utils/dbConnect'
import buttonListConstructor from 'telegram/func/buttonsListConstructor'
import check from 'telegram/func/check'
import formatGameName from 'telegram/func/formatGameName'
import getGame from 'telegram/func/getGame'

const gameTeamsAdmin = async ({ telegramId, jsonCommand }) => {
  const isAdmin = ADMIN_TELEGRAM_IDS.includes(telegramId)

  const checkData = check(jsonCommand, ['gameId'])
  if (checkData) return checkData

  const game = await getGame(jsonCommand?.gameId)
  if (game.success === false) return game

  const isGameStarted = game.status === 'started'
  const isGameFinished = game.status === 'finished'

  const gameTeams = await GamesTeams.find({ gameId: jsonCommand?.gameId })
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
        })
      : []

  const teamsUsers =
    teamsIds.length > 0
      ? await TeamsUsers.find({ teamId: { $in: teamsIds } })
      : []

  const page = jsonCommand?.page ?? 1
  const buttons =
    teams.length > 0
      ? buttonListConstructor(teams, page, (team, number) => {
          const gameTeam = gameTeams.find(
            (gameTeam) => gameTeam.teamId === String(team._id)
          )
          return {
            text: `${number}. "${team.name}"`,
            c: { c: 'gameTeamAdmin', gameTeamId: gameTeam._id },
          }
        })
      : []

  return {
    message: `На игру <b>${formatGameName(
      game
    )}</b> зарегистрировано ${getNounTeams(teams.length)} (${
      teamsUsers.length
    } чел.)\n${teams
      .map(
        (team, index) =>
          `\n${index + 1}. "${team.name}" (${
            teamsUsers.filter(({ teamId }) => teamId === String(team._id))
              .length
          } чел.)`
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
