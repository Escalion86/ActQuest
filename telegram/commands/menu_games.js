import Games from '@models/Games'
import GamesTeams from '@models/GamesTeams'
import Teams from '@models/Teams'
import TeamsUsers from '@models/TeamsUsers'
import dbConnect from '@utils/dbConnect'
import main_menu_button from './menuItems/main_menu_button'

const menu_games = async ({ telegramId, jsonCommand }) => {
  await dbConnect()
  // Получаем список игр
  const games = await Games.find({})
  if (!games || games.length === 0) {
    return {
      message: 'Предстоящих игр не запланировано',
      nextCommand: `main_menu`,
    }
  }
  // Получаем список команд в которых присутствует пользователь
  const teamsUser = await TeamsUsers.find({ userTelegramId: telegramId })
  // if (!teamsUser || teamsUser.length === 0) {
  //   return {
  //     message: 'Вы не состоите ни в какой команде',
  //     nextCommand: `/menu_teams`,
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
      !games || games.length === 0
        ? 'Предстоящих игр не запланировано'
        : 'Предстоящие игры',
    buttons: [
      ...games.map((game) => {
        const gameTeam = gamesTeams.find((gameTeam) => {
          return gameTeam.gameId === String(game._id)
        })
        const isTeamRegistred = !!gameTeam
        // const role = teamUser.role === 'capitan' ? 'Капитан' : 'Участник'
        return {
          text: `"${game.name}"${isTeamRegistred ? ' (записан)' : ''}`,
          command: { command: 'game', gameId: game._id },
          //`game/gameId=${game._id}`,
        }
      }),
      main_menu_button,
    ],
  }
}

export default menu_games
