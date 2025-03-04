import check from 'telegram/func/check'
import getGame from 'telegram/func/getGame'

const editGamePrices = async ({ telegramId, jsonCommand, location, db }) => {
  // --- НЕ САМОСТОЯТЕЛЬНАЯ КОМАНДА
  const checkData = check(jsonCommand, ['gameId'])
  if (checkData) return checkData

  const game = await getGame(jsonCommand.gameId, db)
  if (game.success === false) return game

  const buttons =
    !game.prices || typeof game.prices !== 'object'
      ? []
      : game.prices.map(({ id, name, price }, index) => {
          return {
            text: `${name} - ${price} руб.`,
            c: {
              c: 'editGamePrice',
              gameId: jsonCommand.gameId,
              i: index,
            },
          }
        })

  return {
    success: true,
    message: `Список вариантов участия с ценами\n\n${
      game.prices.length > 0
        ? game.prices
            .map(({ id, name, price }) => `"${name}" - ${price} руб.`)
            .join(',\n')
        : ''
    }`,
    buttons: [
      ...buttons,
      {
        text: '\u{2795} Добавить вариант участия и цену',
        c: {
          c: 'addGamePrice',
          gameId: jsonCommand.gameId,
          i: jsonCommand.i,
        },
      },
      {
        text: '\u{2B05} Назад',
        c: {
          c: 'editGame',
          gameId: jsonCommand.gameId,
        },
      },
    ],
  }
}

export default editGamePrices
