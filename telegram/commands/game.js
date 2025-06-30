import gameDescription from '@helpers/gameDescription'
import isArchiveGame from '@helpers/isArchiveGame'
import isUserAdmin from '@helpers/isUserAdmin'
import check from 'telegram/func/check'
import getGame from 'telegram/func/getGame'
import getTeamOfUserRegistredInAGame from 'telegram/func/getTeamOfUserRegistredInAGame'
import getTeamsUserOfUser from 'telegram/func/getTeamsUserOfUser'

const game = async ({ telegramId, user, jsonCommand, location, db }) => {
  const checkData = check(jsonCommand, ['gameId'])
  if (checkData) return checkData

  const game = await getGame(jsonCommand.gameId, db)
  if (game.success === false) return game

  const isAdmin = isUserAdmin(user)
  const addButtonEditGame = isAdmin || game.creatorTelegramId === telegramId

  const teamsOfUserInAGame = await getTeamOfUserRegistredInAGame(
    telegramId,
    jsonCommand.gameId,
    db
  )

  // const teamsOfUser = getTeamsOfUser(    telegramId,db)
  //   jsonCommand.gameId)

  // const teamsOfGame = getGameTeamsRegistredInAGame(jsonCommand.gameId, db)

  const teamsUserOfUser = await getTeamsUserOfUser(telegramId, db)

  const gameTeams = await db.model('GamesTeams').find({
    gameId: jsonCommand.gameId,
  })

  const creator =
    game.showCreator && game?.creatorTelegramId
      ? await db.model('Users').findOne({
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

  // const teams = await db.model('Teams').find({
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

  const message = `${
    game.status === 'canceled' ? '<b>(ИГРА ОТМЕНЕНА!)</b>\n' : ''
  }${gameDescription(game, creator)}${
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
              text: '\u{1F4AC} Написать организатору',
              hide: !creator,
            },
          ]
        : []),
      {
        url:
          'https://actquest.ru/' +
          location +
          '/game/result/' +
          jsonCommand.gameId,
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
      addButtonEditGame
        ? {
            c: { c: 'editGameGeneral', gameId: jsonCommand.gameId },
            text: '\u{26A1} \u{270F} Редактировать игру',
          }
        : {},
      ,
      {
        c: isArchiveGame(game) ? 'archiveGames' : 'menuGames',
        text: '\u{2B05} Назад',
      },
    ],
  }
}

export default game
