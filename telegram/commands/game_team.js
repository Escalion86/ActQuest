import check from 'telegram/func/check'
import getGame from 'telegram/func/getGame'
import getGameTeam from 'telegram/func/getGameTeam'
import getTeam from 'telegram/func/getTeam'

const game_team = async ({ telegramId, jsonCommand }) => {
  const checkData = check(jsonCommand, ['gameTeamId'])
  if (checkData) return checkData

  const gameTeam = await getGameTeam(jsonCommand.gameTeamId)
  if (gameTeam.success === false) return gameTeam

  const game = await getGame(jsonCommand?.gameId)
  if (game.success === false) return game

  const team = await getTeam(gameTeam.teamId)
  if (team.success === false) return team

  const buttons = [
    {
      cmd: {
        cmd: 'del_game_team',
        gameTeamId: jsonCommand.gameTeamId,
      },
      text: '\u{1F4A3} Удалить команду из игры',
    },
    { cmd: 'menu_games_edit', text: '\u{2B05} Назад' },
  ]

  return {
    message: `Игра "${game.name}".\тКоманда "${team?.name}".${
      team?.description ? `\nОписание: "${team?.description}"` : ''
    }`,
    buttons,
  }
}

export default game_team
