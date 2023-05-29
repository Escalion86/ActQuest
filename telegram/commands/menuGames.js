import Games from '@models/Games'
import GamesTeams from '@models/GamesTeams'
import Teams from '@models/Teams'
import TeamsUsers from '@models/TeamsUsers'
import dbConnect from '@utils/dbConnect'
import mainMenuButton from './menuItems/mainMenuButton'

const menuGames = async ({ telegramId, jsonCommand }) => {
  await dbConnect()
  // Получаем список игр
  const games = await Games.find({})
  const filteredGames = games ? games.filter((game) => !game.hidden) : undefined
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
        ? 'Предстоящих игр не запланировано'
        : 'Предстоящие игры',
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
          text: `"${game.name}"${isTeamRegistred ? ` (записан)` : ''}`,
          cmd: { cmd: 'game', gameId: game._id },
        }
      }),
      mainMenuButton,
    ],
  }
}

export default menuGames
