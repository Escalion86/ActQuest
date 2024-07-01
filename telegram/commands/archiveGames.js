import Games from '@models/Games'
import GamesTeams from '@models/GamesTeams'
// import Teams from '@models/Teams'
import TeamsUsers from '@models/TeamsUsers'
import dbConnect from '@utils/dbConnect'
import { ADMIN_TELEGRAM_IDS } from 'telegram/constants'
import formatGameName from 'telegram/func/formatGameName'
// import mainMenuButton from './menuItems/mainMenuButton'
import buttonListConstructor from 'telegram/func/buttonsListConstructor'

const archiveGames = async ({ telegramId, jsonCommand }) => {
  await dbConnect()
  // Получаем список игр
  const games = (await Games.find({}).lean()).filter(
    (game) => game.status === 'finished'
  )
  if (games.length === 0) {
    return {
      message: 'Прошедших игр небыло',
      nextCommand: `mainMenu`,
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
  const filteredGames = games
    ? games.filter(
        (game) =>
          gamesWithUserIds.includes(String(game._id)) ||
          !game.hidden ||
          ADMIN_TELEGRAM_IDS.includes(telegramId)
      )
    : undefined

  // const filteredGames = games
  //   ? games.filter(
  //       (game) =>
  //         game.status === 'finished' &&
  //         (!game.hidden || ADMIN_TELEGRAM_IDS.includes(telegramId))
  //     )
  //   : undefined
  // // Получаем список команд в которых присутствует пользователь
  // const teamsUser = await TeamsUsers.find({ userTelegramId: telegramId })
  // // if (!teamsUser || teamsUser.length === 0) {
  // //   return {
  // //     message: 'Вы не состоите ни в какой команде',
  // //     nextCommand: `/menuTeams`,
  // //   }
  // // }
  // const teamsIds = teamsUser.map(
  //   (teamUser) =>
  //     // mongoose.Types.ObjectId(teamUser.teamId)
  //     teamUser.teamId
  // )
  // //  Получаем сами команды где пользователь есть
  // // const teams =
  // //   teamsIds.length > 0
  // //     ? await Teams.find({
  // //         _id: { $in: teamsIds },
  // //       })
  // //     : []

  // // Получаем список игр где команды пользователей зарегистрированы
  // const gamesTeams = await GamesTeams.find({
  //   teamId: { $in: teamsIds },
  // })

  const page = jsonCommand?.page ?? 1
  const buttons = buttonListConstructor(filteredGames, page, (game, number) => {
    // TODO поправить вывод зарегистрированных команд пользователя на угру
    // const gameTeam = gamesTeams.find((gameTeam) => {
    //   return gameTeam.gameId === String(game._id)
    // })
    // const isTeamRegistred = !!gameTeam
    const isTeamRegistred = gamesWithUserIds.includes(String(game._id))
    // const team = isTeamRegistred
    //   ? teams.find((team) => String(team._id) === gameTeam.teamId)
    //   : null
    // const role = teamUser.role === 'capitan' ? 'Капитан' : 'Участник'
    return {
      text: `${formatGameName(game)}${isTeamRegistred ? ` (записан)` : ''}`,
      c: { c: 'game', gameId: game._id },
    }
  })

  return {
    message:
      !filteredGames || filteredGames.length === 0
        ? '<b>Прошедших игр небыло</b>'
        : '<b>Прошедшие игры</b>',
    buttons: [...buttons, { c: 'menuGames', text: '\u{2B05} Назад' }],
  }
}

export default archiveGames
