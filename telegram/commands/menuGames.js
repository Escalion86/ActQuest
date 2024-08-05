import Games from '@models/Games'
import GamesTeams from '@models/GamesTeams'
// import Teams from '@models/Teams'
import TeamsUsers from '@models/TeamsUsers'
// import dbConnect from '@utils/dbConnect'
import { ADMIN_TELEGRAM_IDS } from 'telegram/constants'
import formatGameName from 'telegram/func/formatGameName'
import mainMenuButton from './menuItems/mainMenuButton'
import buttonListConstructor from 'telegram/func/buttonsListConstructor'

const menuGames = async ({ telegramId, jsonCommand }) => {
  // await dbConnect() // TODO: Нужно ли это?
  // Получаем список игр
  const games = await Games.find({}).lean()
  const finishedGames = games.filter((game) => game.status === 'finished')
  const notFinishedGames = games.filter((game) => game.status !== 'finished')
  if (!notFinishedGames || notFinishedGames.length === 0) {
    return {
      message: '<b>Предстоящих игр не запланировано</b>',
      buttons: [
        ...(finishedGames?.length > 0
          ? [{ c: 'archiveGames', text: '\u{1F4DA} Архив игр' }]
          : []),
        {
          c: 'joinToGameWithCode',
          text: '\u{1F517} Присоединиться с помощью кода',
        },
        mainMenuButton,
      ],
    }
  }
  // Получаем список команд в которых присутствует пользователь
  const userTeams = await TeamsUsers.find({ userTelegramId: telegramId }).lean()
  // Получаем IDs команд
  const userTeamsIds = userTeams.map(({ teamId }) => teamId)
  // Получаем список игр в которых присутствует пользователь
  const gamesTeamsWithUser = await GamesTeams.find({
    teamId: { $in: userTeamsIds },
  }).lean()
  // Получаем IDs игр
  const gamesWithUserIds = gamesTeamsWithUser.map(({ gameId }) => gameId)
  // Фильтруем список игр
  const filteredGames = notFinishedGames
    ? notFinishedGames.filter(
        (game) =>
          gamesWithUserIds.includes(String(game._id)) ||
          !game.hidden ||
          ADMIN_TELEGRAM_IDS.includes(telegramId)
      )
    : undefined
  // if (!filteredGames || filteredGames.length === 0) {
  //   return {
  //     message: 'Предстоящих игр не запланировано',
  //     nextCommand: `mainMenu`,
  //   }
  // }
  // Получаем список команд в которых присутствует пользователь
  // const teamsUser = await TeamsUsers.find({ userTelegramId: telegramId })
  // if (!teamsUser || teamsUser.length === 0) {
  //   return {
  //     message: 'Вы не состоите ни в какой команде',
  //     nextCommand: `/menuTeams`,
  //   }
  // }
  // const teamsIds = userTeams.map(
  //   ({teamId}) => teamId
  // )
  //  Получаем сами команды где пользователь есть
  // const teams =
  //   teamsIds.length > 0
  //     ? await Teams.find({
  //         _id: { $in: teamsIds },
  //       })
  //     : []

  // Получаем список игр где команды пользователей зарегистрированы
  // const gamesTeams = await GamesTeams.find({
  //   teamId: { $in: teamsIds },
  // })

  const page = jsonCommand?.page ?? 1
  const buttons = buttonListConstructor(filteredGames, page, (game, number) => {
    // TODO поправить вывод зарегистрированных команд пользователя на игру
    const isTeamRegistred = gamesWithUserIds.includes(String(game._id))
    // const team = isTeamRegistred
    //   ? teams.find((team) => String(team._id) === gameTeam.teamId)
    //   : null
    // const role = teamUser.role === 'capitan' ? 'Капитан' : 'Участник'
    return {
      text: `${formatGameName(game)}${isTeamRegistred ? ` (записан)` : ''}${
        game.hidden ? ` (СКРЫТА)` : ''
      }`,
      c: { c: 'game', gameId: game._id },
    }
  })

  return {
    message:
      !filteredGames || filteredGames.length === 0
        ? '<b>Предстоящих игр не запланировано</b>'
        : '<b>Предстоящие игры</b>',
    buttons: [
      ...buttons,
      ...(finishedGames?.length > 0
        ? [{ c: 'archiveGames', text: '\u{1F4DA} Архив игр' }]
        : []),
      {
        c: 'joinToGameWithCode',
        text: '\u{1F517} Присоединиться с помощью кода',
      },
      mainMenuButton,
    ],
  }
}

export default menuGames
