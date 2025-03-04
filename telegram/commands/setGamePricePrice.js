import check from 'telegram/func/check'

const setGamePricePrice = async ({ telegramId, jsonCommand, location, db }) => {
  // --- НЕ САМОСТОЯТЕЛЬНАЯ КОМАНДА
  const checkData = check(jsonCommand, ['gameId', 'i'])
  if (checkData) return checkData

  if (!jsonCommand.message) {
    return {
      success: true,
      message:
        'Введите новую стоимость участия для выбранного варианта (укажите 0, если бесплатно)',
      buttons: [
        {
          text: '\u{1F6AB} Отмена',
          c: {
            c: 'editGamePrice',
            gameId: jsonCommand.gameId,
            i: jsonCommand.i,
          },
        },
      ],
    }
  }

  const game = await db.model('Games').findById(jsonCommand.gameId)

  const price = jsonCommand.message.trim()

  if (!(price == Number(price)) || Number(price) < 0) {
    return {
      success: true,
      message: 'Стоимость должна быть числом!',
      buttons: [
        {
          text: '\u{1F6AB} Отмена',
          c: {
            c: 'editGamePrice',
            gameId: jsonCommand.gameId,
            i: jsonCommand.i,
          },
        },
      ],
    }
  }

  const prices = [...game.prices]
  prices[jsonCommand.i].price = Number(price)

  await db.model('Games').findByIdAndUpdate(jsonCommand.gameId, {
    prices,
  })

  return {
    success: true,
    message: `Стоимость выбранного варианта участия обновлена`,
    nextCommand: {
      c: 'editGamePrice',
      gameId: jsonCommand.gameId,
      i: jsonCommand.i,
    },
  }
}

export default setGamePricePrice
