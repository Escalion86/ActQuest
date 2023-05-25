import GamesTeams from '@models/GamesTeams'
import check from 'telegram/func/check'
import getGame from 'telegram/func/getGame'
import getGameTeamsRegistredInAGame from 'telegram/func/getGameTeamsRegistredInAGame'
import getTeamOfUserRegistredInAGame from 'telegram/func/getTeamOfUserRegistredInAGame'
import getTeamsUserOfUser from 'telegram/func/getTeamsUserOfUser'

const game = async ({ telegramId, jsonCommand }) => {
  const checkData = check(jsonCommand, ['gameId'])
  if (checkData) return checkData

  const game = await getGame(jsonCommand.gameId)
  if (game.success === false) return game

  const teamsOfUserInAGame = await getTeamOfUserRegistredInAGame(
    telegramId,
    jsonCommand.gameId
  )

  // const teamsOfUser = getTeamsOfUser(    telegramId,
  //   jsonCommand.gameId)

  // const teamsOfGame = getGameTeamsRegistredInAGame(jsonCommand.gameId)

  const teamsUserOfUser = await getTeamsUserOfUser(telegramId)

  const gameTeams = await GamesTeams.find({
    gameId: jsonCommand.gameId,
  })

  // const teamsUserOfUserIds = teamsUserOfUser.map(
  //   (teamUser) =>
  //     teamUser.teamId
  // )

  // const teamsOfGameIds = teamsOfGame.map(
  //   (team) =>
  //     // mongoose.Types.ObjectId(teamUser.teamId)
  //     String(team._id)
  // )

  // const teams = await Teams.find({
  //   _id: { $in: teamsIds },
  // })

  const buttons = teamsOfUserInAGame
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
          cmd: { cmd: 'del_game_team', gameTeamId: String(gameTeam._id) },
        }
      }
      return undefined
    })
    .filter((data) => data !== undefined)

  const message = `Игра "${game?.name}".${
    game?.description ? `\nОписание: "${game?.description}"` : ''
  }${
    teamsOfUserInAGame && teamsOfUserInAGame.length > 0
      ? `\n\n${
          teamsOfUserInAGame.length === 1
            ? 'Записана ваша команда'
            : 'Записаны ваши команды'
        } ${teamsOfUserInAGame.map((team) => `"${team.name}"`).join(', ')}`
      : ''
  }`

  return {
    message,
    buttons: [
      {
        cmd: { cmd: 'join_game', gameId: jsonCommand.gameId },
        text: '\u{270F} Зарегистрироваться на игру',
        hide: teamsOfUserInAGame,
      },
      ...buttons,
      {
        cmd: { cmd: 'game_teams', gameId: jsonCommand.gameId },
        text: '\u{1F465} Зарегистрированные команды',
      },
      { cmd: 'menu_games', text: '\u{2B05} Назад' },
    ],
  }
}

export default game
