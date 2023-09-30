import secondsToTimeStr from '@helpers/secondsToTimeStr'
import GamesTeams from '@models/GamesTeams'
import moment from 'moment-timezone'
import check from 'telegram/func/check'
import getGame from 'telegram/func/getGame'
import getGameTeamsRegistredInAGame from 'telegram/func/getGameTeamsRegistredInAGame'
import getTeamOfUserRegistredInAGame from 'telegram/func/getTeamOfUserRegistredInAGame'
import getTeamsUserOfUser from 'telegram/func/getTeamsUserOfUser'

const game = async ({ telegramId, jsonCommand }) => {
  const checkData = check(jsonCommand, ['gameId'])
  if (checkData) return checkData

  const game = await getGame(jsonCommand.gameId)
  if (game.success === false) return game

  const teamsOfUserInAGame = await getTeamOfUserRegistredInAGame(
    telegramId,
    jsonCommand.gameId
  )

  // const teamsOfUser = getTeamsOfUser(    telegramId,
  //   jsonCommand.gameId)

  // const teamsOfGame = getGameTeamsRegistredInAGame(jsonCommand.gameId)

  const teamsUserOfUser = await getTeamsUserOfUser(telegramId)

  const gameTeams = await GamesTeams.find({
    gameId: jsonCommand.gameId,
  })

  // const teamsUserOfUserIds = teamsUserOfUser.map(
  //   (teamUser) =>
  //     teamUser.teamId
  // )

  // const teamsOfGameIds = teamsOfGame.map(
  //   (team) =>
  //     // mongoose.Types.ObjectId(teamUser.teamId)
  //     String(team._id)
  // )

  // const teams = await Teams.find({
  //   _id: { $in: teamsIds },
  // })

  const isGameStarted = game.status === 'started'
  const isGameFinished = game.status === 'finished'

  const buttons = isGameFinished
    ? []
    : isGameStarted
    ? teamsOfUserInAGame.map((team) => {
        const gameTeam = gameTeams.find(
          (gameTeam) => gameTeam.teamId === String(team._id)
        )
        return {
          c: { c: 'gameProcess', gameTeamId: String(gameTeam._id) },
          text: `\u{26A1} ЗАЙТИ В ИГРУ ("${team.name}")`,
        }
      })
    : teamsOfUserInAGame
        .map((team) => {
          const teamUserOfUser = teamsUserOfUser.find(
            (teamUser) => teamUser.teamId === String(team._id)
          )
          if (teamUserOfUser && teamUserOfUser?.role === 'capitan') {
            const gameTeam = gameTeams.find(
              (gameTeam) => gameTeam.teamId === String(team._id)
            )
            return {
              // text: `"${team.name}" (вы ${
              //   teamUserOfUser.role === 'capitan' ? 'капитан' : 'участник'
              // } команды)`,
              text: `Отменить регистрацию команды "${team.name}"`,
              c: { c: 'delGameTeam', gameTeamId: String(gameTeam._id) },
            }
          }
          return undefined
        })
        .filter((data) => data !== undefined)

  const message = `<b>Игра "${game?.name}"</b>\n\n<b>Дата и время</b>: ${
    game.dateStart
      ? moment(game.dateStart).tz('Asia/Krasnoyarsk').format('DD.MM.yyyy H:mm')
      : '[не заданы]'
  }${
    teamsOfUserInAGame && teamsOfUserInAGame.length > 0
      ? `\n\n${
          teamsOfUserInAGame.length === 1
            ? '<b>Записана ваша команда</b>'
            : '<b>Записаны ваши команды:</b>'
        } ${teamsOfUserInAGame.map((team) => `"${team.name}"`).join(', ')}`
      : ''
  }${
    game?.startingPlace
      ? `\n\n<b>Время и место сбора</b>: ${game?.startingPlace}`
      : ''
  }\n\n<b>Количество заданий</b>: ${
    game?.tasks?.length ?? 0
  }\n<b>Максимальная продолжительность одного задания</b>: ${secondsToTimeStr(
    game?.taskDuration ?? 3600
  )}\n<b>Время до подсказки</b>: ${secondsToTimeStr(
    game?.cluesDuration ?? 1200
  )}\n<b>Перерыв между заданиями</b>: ${
    !game?.breakDuration ? 'отсутствует' : secondsToTimeStr(game?.breakDuration)
  }\n<b>Штраф за невыполнение задания</b>: ${
    !game?.taskFailurePenalty
      ? 'отсутствует'
      : secondsToTimeStr(game?.taskFailurePenalty)
  }\n\n<b>Организатор игры</b>: <a href="tg://user?id=261102161">Алексей Белинский</a> (кликните, чтобы написать организатору)`

  return {
    message,
    images: game.image ? [game.image] : undefined,
    buttons: [
      {
        c: { c: 'gameResult', gameId: jsonCommand.gameId },
        text: '\u{1F4CB} Посмотреть результаты игры',
        hide: game.status !== 'finished' || !game.result,
      },
      {
        c: { c: 'joinGame', gameId: jsonCommand.gameId },
        text: '\u{270F} Зарегистрироваться на игру',
        hide:
          isGameStarted ||
          isGameFinished ||
          (teamsOfUserInAGame && teamsOfUserInAGame.length > 0),
      },
      ...buttons,
      {
        c: { c: 'gameTeams', gameId: jsonCommand.gameId },
        text: '\u{1F465} Зарегистрированные команды',
        hide: game.status === 'finished',
      },
      { c: 'menuGames', text: '\u{2B05} Назад' },
    ],
  }
}

export default game
