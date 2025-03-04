import check from 'telegram/func/check'

const setGamePriceName = async ({ telegramId, jsonCommand, location, db }) => {
  // --- НЕ САМОСТОЯТЕЛЬНАЯ КОМАНДА
  const checkData = check(jsonCommand, ['gameId', 'i'])
  if (checkData) return checkData

  if (!jsonCommand.message) {
    return {
      success: true,
      message: 'Введите новое название варианта участия',
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
  const prices = [...game.prices]
  prices[jsonCommand.i].name = jsonCommand.message.trim()

  await db.model('Games').findByIdAndUpdate(jsonCommand.gameId, {
    prices,
  })

  return {
    success: true,
    message: `Название варианта участия обновлено`,
    nextCommand: {
      c: 'editGamePrice',
      gameId: jsonCommand.gameId,
      i: jsonCommand.i,
    },
  }
}

export default setGamePriceName
