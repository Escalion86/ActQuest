import check from 'telegram/func/check'
import formatGameName from 'telegram/func/formatGameName'
import getGame from 'telegram/func/getGame'
import getGameTeam from 'telegram/func/getGameTeam'

const gameTeamResult = async ({ telegramId, jsonCommand }) => {
  const checkData = check(jsonCommand, ['gameTeamId'])
  if (checkData) return checkData

  const gameTeam = await getGameTeam(jsonCommand.gameTeamId)
  if (gameTeam.success === false) return gameTeam

  const game = await getGame(gameTeam.gameId)
  if (game.success === false) return game

  const team = game.result.teams.find((team) => team._id === gameTeam.teamId)

  return {
    message: `<b>Игра ${formatGameName(game)}\n\nКоманда "${team?.name}"</b>`,
    buttons: [
      // {
      //   c: {
      //     c: 'delGameTeam',
      //     gameTeamId: jsonCommand.gameTeamId,
      //   },
      //   text: '\u{1F4A3} Удалить команду из игры',
      //   hide: !(
      //     game.status === 'active' &&
      //     (isAdmin || capitanTelegramId === telegramId)
      //   ),
      // },
      {
        c: { c: 'gameTeamsResult', gameId: String(game._id) },
        text: '\u{2B05} Назад',
      },
    ],
  }
}

export default gameTeamResult
