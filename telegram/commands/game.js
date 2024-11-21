import gameDescription from '@helpers/gameDescription'
import { getNounPoints } from '@helpers/getNoun'
import isUserAdmin from '@helpers/isUserAdmin'
import secondsToTimeStr from '@helpers/secondsToTimeStr'
import GamesTeams from '@models/GamesTeams'
import Users from '@models/Users'
import moment from 'moment-timezone'
import check from 'telegram/func/check'
import getGame from 'telegram/func/getGame'
import getGameTeamsRegistredInAGame from 'telegram/func/getGameTeamsRegistredInAGame'
import getTeamOfUserRegistredInAGame from 'telegram/func/getTeamOfUserRegistredInAGame'
import getTeamsUserOfUser from 'telegram/func/getTeamsUserOfUser'

const game = async ({ telegramId, user, jsonCommand, domen }) => {
  const checkData = check(jsonCommand, ['gameId'])
  if (checkData) return checkData

  const game = await getGame(jsonCommand.gameId)
  if (game.success === false) return game

  const isAdmin = isUserAdmin(user)

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

  const creator =
    game.showCreator && game?.creatorTelegramId
      ? await Users.findOne({
          telegramId: game?.creatorTelegramId,
        })
      : undefined
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

  const message = `${gameDescription(game, creator)}${
    teamsOfUserInAGame && teamsOfUserInAGame.length > 0
      ? `\n\n\n${
          teamsOfUserInAGame.length === 1
            ? '<b>На игру записана ваша команда</b>'
            : '<b>На игру записаны ваши команды:</b>'
        } ${teamsOfUserInAGame.map((team) => `"${team.name}"`).join(', ')}`
      : ''
  }`

  return {
    message,
    images: game.image ? [game.image] : undefined,
    buttons: [
      ...(game.showCreator
        ? [
            {
              url: `t.me/+${creator?.phone}`,
              text: '\u{1F4AC} Написать орагнизатору',
              hide: !creator,
            },
          ]
        : []),
      {
        url:
          'https://actquest.ru/' + domen + '/game/result/' + jsonCommand.gameId,
        text: '\u{1F30F} Посмотреть результаты игры на сайте',
        hide:
          game.type === 'photo' ||
          game.status !== 'finished' ||
          !game.result ||
          game.hideResult,
      },
      {
        c: { c: 'gameResult', gameId: jsonCommand.gameId },
        text: '\u{1F4CB} Посмотреть результаты игры',
        hide: game.status !== 'finished' || !game.result || game.hideResult,
      },
      {
        c: { c: 'gameTeamsResult', gameId: jsonCommand.gameId },
        text: '\u{1F4CB}\u{1F465} Посмотреть результаты по командам',
        hide: game.status !== 'finished' || !game.result || game.hideResult,
      },
      {
        c: { c: 'gameTasksView', gameId: jsonCommand.gameId },
        text: '\u{1F3AF} Посмотреть задания на игре',
        hide: game.status !== 'finished' || !game.showTasks,
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
      {
        c: { c: 'gamePhotos', gameId: jsonCommand.gameId },
        text: '\u{1F4F7} Посмотреть фото-ответы на игре',
        hide:
          game.type !== 'photo' ||
          game.status !== 'finished' ||
          !(isAdmin || teamsOfUserInAGame.length > 0),
      },
      { c: 'menuGames', text: '\u{2B05} Назад' },
    ],
  }
}

export default game
