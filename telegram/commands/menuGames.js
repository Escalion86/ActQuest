import Games from '@models/Games'
import GamesTeams from '@models/GamesTeams'
import Teams from '@models/Teams'
import TeamsUsers from '@models/TeamsUsers'
import dbConnect from '@utils/dbConnect'
import { ADMIN_TELEGRAM_ID } from 'telegram/constants'
import formatGameName from 'telegram/func/formatGameName'
import mainMenuButton from './menuItems/mainMenuButton'

const menuGames = async ({ telegramId, jsonCommand }) => {
  await dbConnect()
  // Получаем список игр
  const games = await Games.find({})
  const filteredGames = games
    ? games.filter(
        (game) =>
          !game.hidden ||
          telegramId === ADMIN_TELEGRAM_ID ||
          telegramId === 5960834042
      )
    : undefined
  if (!filteredGames || filteredGames.length === 0) {
    return {
      message: 'Предстоящих игр не запланировано',
      nextCommand: `mainMenu`,
    }
  }
  // Получаем список команд в которых присутствует пользователь
  const teamsUser = await TeamsUsers.find({ userTelegramId: telegramId })
  // if (!teamsUser || teamsUser.length === 0) {
  //   return {
  //     message: 'Вы не состоите ни в какой команде',
  //     nextCommand: `/menuTeams`,
  //   }
  // }
  const teamsIds = teamsUser.map(
    (teamUser) =>
      // mongoose.Types.ObjectId(teamUser.teamId)
      teamUser.teamId
  )
  //  Получаем сами команды где пользователь есть
  const teams =
    teamsIds.length > 0
      ? await Teams.find({
          _id: { $in: teamsIds },
        })
      : []

  // Получаем список игр где команды пользователей зарегистрированы
  const gamesTeams = await GamesTeams.find({
    teamId: { $in: teamsIds },
  })

  return {
    message:
      !filteredGames || filteredGames.length === 0
        ? '<b>Предстоящих игр не запланировано</b>'
        : '<b>Предстоящие игры</b>',
    buttons: [
      ...filteredGames.map((game) => {
        // TODO поправить вывод зарегистрированных команд пользователя на угру
        const gameTeam = gamesTeams.find((gameTeam) => {
          return gameTeam.gameId === String(game._id)
        })
        const isTeamRegistred = !!gameTeam
        // const team = isTeamRegistred
        //   ? teams.find((team) => String(team._id) === gameTeam.teamId)
        //   : null
        // const role = teamUser.role === 'capitan' ? 'Капитан' : 'Участник'
        return {
          text: `${formatGameName(game)}${isTeamRegistred ? ` (записан)` : ''}`,
          c: { c: 'game', gameId: game._id },
        }
      }),
      mainMenuButton,
    ],
  }
}

export default menuGames
