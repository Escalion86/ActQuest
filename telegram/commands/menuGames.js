import formatGameName from 'telegram/func/formatGameName'
import mainMenuButton from './menuItems/mainMenuButton'
import buttonListConstructor from 'telegram/func/buttonsListConstructor'
import isUserAdmin from '@helpers/isUserAdmin'
import isArchiveGame from '@helpers/isArchiveGame'

const menuGames = async ({ telegramId, jsonCommand, user, db }) => {
  // Получаем список игр
  const games = await db.model('Games').find({}).lean()
  const archiveGames = games.filter((game) => isArchiveGame(game))
  const notArchiveGames = games.filter((game) => !isArchiveGame(game))
  if (!notArchiveGames || notArchiveGames.length === 0) {
    return {
      message: '<b>Предстоящих игр не запланировано</b>',
      buttons: [
        ...(archiveGames?.length > 0
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

  const isAdmin = isUserAdmin(user)

  // Получаем список команд в которых присутствует пользователь
  const userTeams = await db
    .model('TeamsUsers')
    .find({ userTelegramId: telegramId })
    .lean()
  // Получаем IDs команд
  const userTeamsIds = userTeams.map(({ teamId }) => teamId)
  // Получаем список игр в которых присутствует пользователь
  const gamesTeamsWithUser = await db
    .model('GamesTeams')
    .find({
      teamId: { $in: userTeamsIds },
    })
    .lean()
  // Получаем IDs игр
  const gamesWithUserIds = gamesTeamsWithUser.map(({ gameId }) => gameId)
  // Фильтруем список игр
  const filteredGames = notArchiveGames
    ? notArchiveGames.filter(
        (game) =>
          gamesWithUserIds.includes(String(game._id)) || !game.hidden || isAdmin
      )
    : undefined
  // if (!filteredGames || filteredGames.length === 0) {
  //   return {
  //     message: 'Предстоящих игр не запланировано',
  //     nextCommand: `mainMenu`,
  //   }
  // }
  // Получаем список команд в которых присутствует пользователь
  // const teamsUser = await db.model('TeamsUsers').find({ userTelegramId: telegramId })
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
  //     ? await db.model('Teams').find({
  //         _id: { $in: teamsIds },
  //       })
  //     : []

  // Получаем список игр где команды пользователей зарегистрированы
  // const gamesTeams = await db.model('GamesTeams').find({
  //   teamId: { $in: teamsIds },
  // })

  const page = jsonCommand?.page ?? 1
  const buttons = buttonListConstructor(filteredGames, page, (game, number) => {
    // TODO поправить вывод зарегистрированных команд пользователя на игру
    const isTeamRegistred = gamesWithUserIds.includes(String(game._id))
    return {
      text: `${number}. ${formatGameName(game)}${
        isTeamRegistred ? ` (записан)` : ''
      }${game.hidden ? ` (СКРЫТА)` : ''}${
        game.status === 'canceled' ? ` (ОТМЕНЕНА)` : ''
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
      ...(archiveGames?.length > 0
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
