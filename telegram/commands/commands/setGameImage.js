import Games from '@models/Games'
import dbConnect from '@utils/dbConnect'
import check from 'telegram/func/check'

const setGameImage = async ({ telegramId, jsonCommand }) => {
  // --- НЕ САМОСТОЯТЕЛЬНАЯ КОМАНДА
  const checkData = check(jsonCommand, ['gameId'])
  if (checkData) return checkData

  if (!jsonCommand.message) {
    return {
      success: true,
      message: 'Отправьте новую картинку игры',
      buttons: [
        {
          text: '\u{1F6AB} Отмена',
          c: { c: 'editGame', gameId: jsonCommand.gameId },
        },
      ],
    }
  }
  await dbConnect()
  const game = await Games.findByIdAndUpdate(jsonCommand.gameId, {
    image: jsonCommand.message,
  })

  return {
    success: true,
    message: `Картинка игры обновлена`,
    nextCommand: { c: 'editGame', gameId: jsonCommand.gameId },
  }
}

export default setGameImage
