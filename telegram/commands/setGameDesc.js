import Games from '@models/Games'
// import dbConnect from '@utils/dbConnect'
import check from 'telegram/func/check'

const setGameDesc = async ({ telegramId, jsonCommand }) => {
  // --- НЕ САМОСТОЯТЕЛЬНАЯ КОМАНДА
  const checkData = check(jsonCommand, ['gameId'])
  if (checkData) return checkData

  if (!jsonCommand.message) {
    return {
      success: true,
      message: 'Введите новое описание игры',
      buttons: [
        {
          text: '\u{1F6AB} Отмена',
          c: { c: 'editGame', gameId: jsonCommand.gameId },
        },
      ],
    }
  }
  // await dbConnect() // TODO: Нужно ли это?
  const game = await Games.findByIdAndUpdate(jsonCommand.gameId, {
    description: jsonCommand.message,
  })

  return {
    success: true,
    message: `Описание игры обновлено на "${jsonCommand.message}"`,
    nextCommand: { c: 'editGame', gameId: jsonCommand.gameId },
  }
}

export default setGameDesc
