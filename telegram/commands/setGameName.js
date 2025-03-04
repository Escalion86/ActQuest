import check from 'telegram/func/check'

const setGameName = async ({ telegramId, jsonCommand, location, db }) => {
  // --- НЕ САМОСТОЯТЕЛЬНАЯ КОМАНДА
  const checkData = check(jsonCommand, ['gameId'])
  if (checkData) return checkData

  if (!jsonCommand.message) {
    return {
      success: true,
      message: 'Введите новое название игры',
      buttons: [
        {
          text: '\u{1F6AB} Отмена',
          c: { c: 'editGame', gameId: jsonCommand.gameId },
        },
      ],
    }
  }
  const game = await db.model('Games').findByIdAndUpdate(jsonCommand.gameId, {
    name: jsonCommand.message,
  })

  return {
    success: true,
    message: `Название игры обновлено на "${jsonCommand.message}"`,
    nextCommand: { c: 'editGame', gameId: jsonCommand.gameId },
  }
}

export default setGameName
