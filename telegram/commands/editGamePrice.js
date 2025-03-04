import secondsToTimeStr from '@helpers/secondsToTimeStr'
import check from 'telegram/func/check'
import getGame from 'telegram/func/getGame'
import updateGame from 'telegram/func/updateGame'

const editGamePrice = async ({ telegramId, jsonCommand, location, db }) => {
  // --- НЕ САМОСТОЯТЕЛЬНАЯ КОМАНДА
  const checkData = check(jsonCommand, ['gameId', 'i'])
  if (checkData) return checkData

  const game = await getGame(jsonCommand.gameId, db)
  if (game.success === false) return game

  if (jsonCommand.delete) {
    game.prices.splice(jsonCommand.i, 1)

    await updateGame(
      jsonCommand.gameId,
      {
        prices: game.prices,
      },
      db
    )

    return {
      success: true,
      message: 'Вариант участия удален',
      nextCommand: {
        c: 'editGamePrices',
        gameId: jsonCommand.gameId,
      },
    }
  }

  const gamePriceVariant = game.prices[jsonCommand.i]

  return {
    success: true,
    message: `Вариант участия "${gamePriceVariant.name}" - ${gamePriceVariant.price} руб.`,
    buttons: [
      {
        text: '\u{270F} Название варианта',
        c: {
          c: 'setGamePriceName',
          gameId: jsonCommand.gameId,
          i: jsonCommand.i,
        },
      },
      {
        text: '\u{270F} Цена',
        c: {
          c: 'setGamePricePrice',
          gameId: jsonCommand.gameId,
          i: jsonCommand.i,
        },
      },
      {
        text: '\u{1F5D1} Удалить вариант участия',
        c: {
          delete: true,
        },
      },
      {
        text: '\u{2B05} Назад',
        c: {
          c: 'editGamePrices',
          gameId: jsonCommand.gameId,
        },
      },
    ],
  }
}

export default editGamePrice
