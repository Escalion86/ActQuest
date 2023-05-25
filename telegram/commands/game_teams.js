import GamesTeams from '@models/GamesTeams'
import Teams from '@models/Teams'
import dbConnect from '@utils/dbConnect'
import getGame from 'telegram/func/getGame'

const game_teams = async ({ telegramId, jsonCommand }) => {
  const checkData = check(jsonCommand, ['gameId'])
  if (checkData) return checkData

  const game = await getGame(jsonCommand?.gameId)
  if (game.success === false) return game

  await dbConnect()
  const gameTeams = await GamesTeams.find({ gameId: jsonCommand?.gameId })
  if (!gameTeams || gameTeams.length === 0) {
    return {
      message: 'Никто не записался на игру',
      nextCommand: `menu_games_edit`,
    }
  }

  const teamsIds = gameTeams.map(
    (gameTeam) =>
      // mongoose.Types.ObjectId(teamUser.teamId)
      gameTeam.teamId
  )

  const teams = await Teams.find({
    _id: { $in: teamsIds },
  })

  const buttons = teams.map((team) => {
    const gameTeam = gameTeams.find(
      (gameTeam) => gameTeam.team_id === String(team._id)
    )
    return {
      text: `"${team.name}"`,
      cmd: { cmd: 'game_team', gameTeamId: gameTeam._id },
      // `team_user/teamUserId=${teamUser._id}`,
    }
  })

  return {
    message: `Команды зарегистрированные на игру "${game.name}"`,
    buttons: [...buttons, { cmd: 'menu_games_edit', text: '\u{2B05} Назад' }],
  }
}

export default game_teams
