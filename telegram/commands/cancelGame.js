import check from 'telegram/func/check'
import formatGameName from 'telegram/func/formatGameName'
import getGame from 'telegram/func/getGame'

const cancelGame = async ({ telegramId, jsonCommand, location, db }) => {
  // --- НЕ САМОСТОЯТЕЛЬНАЯ КОМАНДА
  const checkData = check(jsonCommand, ['gameId'])
  if (checkData) return checkData

  const game = await getGame(jsonCommand.gameId, db)
  if (game.success === false) return game

  if (!jsonCommand.confirm) {
    return {
      success: true,
      message: `Подтвердите отмену игры ${formatGameName(game)}`,
      buttons: [
        {
          text: '\u{26D4} Отменить игру',
          c: { confirm: true },
        },
        {
          text: '\u{1F6AB} Я передумал',
          c: { c: 'editGameGeneral', gameId: jsonCommand.gameId },
        },
      ],
    }
  }

  await db
    .model('Games')
    .findByIdAndUpdate(jsonCommand.gameId, { status: 'canceled' })

  return {
    success: true,
    message: 'Игра отменена',
    nextCommand: `menuGamesEdit`,
  }
}

export default cancelGame
