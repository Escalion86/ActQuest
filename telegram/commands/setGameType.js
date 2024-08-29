import Games from '@models/Games'
// import dbConnect from '@utils/dbConnect'
import check from 'telegram/func/check'

const setGameType = async ({ telegramId, jsonCommand }) => {
  // --- НЕ САМОСТОЯТЕЛЬНАЯ КОМАНДА
  const checkData = check(jsonCommand, ['gameId'])
  if (checkData) return checkData

  if (typeof jsonCommand.type !== 'boolean') {
    return {
      success: true,
      message: 'Выберите тип игры',
      buttons: [
        {
          c: { type: 'classic' },
          text: '\u{1F697} Классика',
        },
        {
          c: { type: 'photo' },
          text: '\u{1F4F7} Фотоквест',
        },
        {
          text: '\u{1F6AB} Отмена',
          c: { c: 'editGame', gameId: jsonCommand.gameId },
        },
      ],
    }
  }
  const game = await Games.findByIdAndUpdate(jsonCommand.gameId, {
    type: jsonCommand.type,
  })

  return {
    success: true,
    message: `Установлен тип игры "${
      jsonCommand.type === 'photo'
        ? '\u{1F4F7} Фотоквест'
        : '\u{1F697} Классика'
    }"`,
    nextCommand: { c: 'editGame', gameId: jsonCommand.gameId },
  }
}

export default setGameType
