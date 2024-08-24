import Games from '@models/Games'
// import dbConnect from '@utils/dbConnect'
import check from 'telegram/func/check'

const setGameName = async ({ telegramId, jsonCommand }) => {
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
  const game = await Games.findByIdAndUpdate(jsonCommand.gameId, {
    name: jsonCommand.message,
  })

  return {
    success: true,
    message: `Название игры обновлено на "${jsonCommand.message}"`,
    nextCommand: { c: 'editGame', gameId: jsonCommand.gameId },
  }
}

export default setGameName
