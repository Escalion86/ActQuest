import check from 'telegram/func/check'
import formatGameName from 'telegram/func/formatGameName'
import getGame from 'telegram/func/getGame'

const delGame = async ({ telegramId, jsonCommand, location, db }) => {
  // --- НЕ САМОСТОЯТЕЛЬНАЯ КОМАНДА
  const checkData = check(jsonCommand, ['gameId'])
  if (checkData) return checkData

  const game = await getGame(jsonCommand.gameId, db)
  if (game.success === false) return game

  if (!jsonCommand.confirm) {
    return {
      success: true,
      message: `Подтвердите удаление игры ${formatGameName(game)}`,
      buttons: [
        {
          text: '\u{1F4A3} Удалить',
          c: { confirm: true },
        },
        {
          text: '\u{1F6AB} Я передумал',
          c: { c: 'editGameGeneral', gameId: jsonCommand.gameId },
        },
      ],
    }
  }

  await db.model('Games').findByIdAndRemove(jsonCommand.gameId)
  await db.model('GamesTeams').deleteMany({ gameId: jsonCommand.gameId })
  return {
    success: true,
    message: 'Игра удалена',
    nextCommand: `menuGamesEdit`,
  }
}

export default delGame
