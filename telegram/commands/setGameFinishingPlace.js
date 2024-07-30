import Games from '@models/Games'
// import dbConnect from '@utils/dbConnect'
import check from 'telegram/func/check'

const setGameFinishingPlace = async ({ telegramId, jsonCommand }) => {
  // --- НЕ САМОСТОЯТЕЛЬНАЯ КОМАНДА
  const checkData = check(jsonCommand, ['gameId'])
  if (checkData) return checkData

  if (jsonCommand.noFinishingPlace) {
    // await dbConnect() // TODO: Нужно ли это?
    const game = await Games.findByIdAndUpdate(jsonCommand.gameId, {
      finishingPlace: '',
    })

    return {
      success: true,
      message: `Место сбора по окончанию игры удалено`,
      nextCommand: { c: 'editGame', gameId: jsonCommand.gameId },
    }
  }

  if (!jsonCommand.message) {
    return {
      success: true,
      message: 'Введите место сбора по окончанию игры',
      buttons: [
        {
          text: 'Без указания места сбора',
          c: { noFinishingPlace: true },
        },
        {
          text: '\u{1F6AB} Отмена',
          c: { c: 'editGame', gameId: jsonCommand.gameId },
        },
      ],
    }
  }
  // await dbConnect() // TODO: Нужно ли это?
  const game = await Games.findByIdAndUpdate(jsonCommand.gameId, {
    finishingPlace: jsonCommand.message,
  })

  return {
    success: true,
    message: `Место сбора по окончанию игры на "${jsonCommand.message}"`,
    nextCommand: { c: 'editGame', gameId: jsonCommand.gameId },
  }
}

export default setGameFinishingPlace
