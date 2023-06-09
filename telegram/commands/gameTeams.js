import GamesTeams from '@models/GamesTeams'
import Teams from '@models/Teams'
import dbConnect from '@utils/dbConnect'
import check from 'telegram/func/check'
import formatGameName from 'telegram/func/formatGameName'
import getGame from 'telegram/func/getGame'

const gameTeams = async ({ telegramId, jsonCommand }) => {
  const checkData = check(jsonCommand, ['gameId'])
  if (checkData) return checkData

  const game = await getGame(jsonCommand?.gameId)
  if (game.success === false) return game

  await dbConnect()
  const gameTeams = await GamesTeams.find({ gameId: jsonCommand?.gameId })
  if (!gameTeams || gameTeams.length === 0) {
    return {
      message: 'Никто не записался на игру',
      nextCommand: `menuGames`,
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
      (gameTeam) => gameTeam.teamId === String(team._id)
    )
    return {
      text: `"${team.name}"`,
      c: { c: 'gameTeam', gameTeamId: gameTeam._id },
      // `teamUser/teamUserId=${teamUser._id}`,
    }
  })

  return {
    message: `<b>Команды зарегистрированные на игру ${formatGameName(
      game
    )}</b>`,
    buttons: [...buttons, { c: 'menuGames', text: '\u{2B05} Назад' }],
  }
}

export default gameTeams
