import Games from '@models/Games'
import GamesTeams from '@models/GamesTeams'
// import dbConnect from '@utils/dbConnect'
import check from 'telegram/func/check'
import formatGameName from 'telegram/func/formatGameName'
import getGame from 'telegram/func/getGame'

const delGame = async ({ telegramId, jsonCommand }) => {
  // --- НЕ САМОСТОЯТЕЛЬНАЯ КОМАНДА
  const checkData = check(jsonCommand, ['gameId'])
  if (checkData) return checkData

  const game = await getGame(jsonCommand.gameId)
  if (game.success === false) return game

  if (!jsonCommand.confirm) {
    return {
      success: true,
      message: `Подтвердите удаление игры ${formatGameName(game)}`,
      buttons: [
        {
          text: '\u{1F5D1} Удалить',
          c: { confirm: true },
        },
        {
          text: '\u{1F6AB} Отмена',
          c: { c: 'editGame', gameId: jsonCommand.gameId },
        },
      ],
    }
  }

  await Games.findByIdAndRemove(jsonCommand.gameId)
  await GamesTeams.deleteMany({ gameId: jsonCommand.gameId })
  return {
    success: true,
    message: 'Игра удалена',
    nextCommand: `menuGamesEdit`,
  }
}

export default delGame
