import Teams from '@models/Teams'
import check from 'telegram/func/check'
import getGame from 'telegram/func/getGame'
import getGameTeamsOfUserRegistredInAGame from 'telegram/func/getGameTeamsOfUserRegistredInAGame'
import getTeamOfUserRegistredInAGame from 'telegram/func/getTeamOfUserRegistredInAGame'

const game = async ({ telegramId, jsonCommand }) => {
  const checkData = check(jsonCommand, ['gameId'])
  if (checkData) return checkData

  const game = await getGame(jsonCommand.gameId)
  if (game.success === false) return game

  const gameTeams = await getGameTeamsOfUserRegistredInAGame(
    telegramId,
    jsonCommand.gameId
  )

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
      cmd: { cmd: 'detach_game_team', gameTeamId: gameTeam._id },
      // `team_user/teamUserId=${teamUser._id}`,
    }
  })

  return {
    message: `Игра "${game?.name}".${
      game?.description ? `\nОписание: "${game?.description}"` : ''
    }${
      teamsInGame
        ? `\n\nЗаписана команда ${teamsInGame
            .map((team) => `"${team.name}"`)
            .join(', ')}`
        : ''
    }`,
    buttons: [
      {
        cmd: { cmd: 'join_game', gameId: jsonCommand.gameId },
        text: '\u{270F} Зарегистрироваться на игру',
        hide: teamsInGame,
      },
      ...buttons,
      { cmd: 'menu_games', text: '\u{2B05} Назад' },
    ],
  }
}

export default game
