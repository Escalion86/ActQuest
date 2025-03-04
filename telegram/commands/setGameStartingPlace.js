import check from 'telegram/func/check'

const setGameStartingPlace = async ({
  telegramId,
  jsonCommand,
  location,
  db,
}) => {
  // --- НЕ САМОСТОЯТЕЛЬНАЯ КОМАНДА
  const checkData = check(jsonCommand, ['gameId'])
  if (checkData) return checkData

  if (jsonCommand.noStartingPlace) {
    const game = await db.model('Games').findByIdAndUpdate(jsonCommand.gameId, {
      startingPlace: '',
    })

    return {
      success: true,
      message: `Место сбора на начало игры удалено`,
      nextCommand: { c: 'editGame', gameId: jsonCommand.gameId },
    }
  }

  if (!jsonCommand.message) {
    return {
      success: true,
      message: 'Введите место сбора на начало игры',
      buttons: [
        {
          text: 'Без указания места сбора',
          c: { noStartingPlace: true },
        },
        {
          text: '\u{1F6AB} Отмена',
          c: { c: 'editGame', gameId: jsonCommand.gameId },
        },
      ],
    }
  }
  const game = await db.model('Games').findByIdAndUpdate(jsonCommand.gameId, {
    startingPlace: jsonCommand.message,
  })

  return {
    success: true,
    message: `Место сбора на начало игры на "${jsonCommand.message}"`,
    nextCommand: { c: 'editGame', gameId: jsonCommand.gameId },
  }
}

export default setGameStartingPlace
