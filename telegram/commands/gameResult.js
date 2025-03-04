import check from 'telegram/func/check'
import getGame from 'telegram/func/getGame'

const gameResult = async ({ telegramId, jsonCommand, location, db }) => {
  const checkData = check(jsonCommand, ['gameId'])
  if (checkData) return checkData

  const game = await getGame(jsonCommand.gameId, db)
  if (game.success === false) return game

  if (game.status !== 'finished') {
    return {
      message: 'Игра еще не завершена',
      nextCommand: { c: 'game', gameId: jsonCommand.gameId },
    }
  }

  if (!game.result) {
    return {
      message: 'Результаты игры еще не сформированы',
      nextCommand: { c: 'game', gameId: jsonCommand.gameId },
    }
  }

  return {
    message: game.result.text,
    buttons: [
      {
        text: '\u{2B05} Назад',
        c: { c: 'game', gameId: jsonCommand.gameId },
      },
    ],
  }
}

export default gameResult
