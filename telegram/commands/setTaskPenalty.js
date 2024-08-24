import secondsToTimeStr from '@helpers/secondsToTimeStr'
import Games from '@models/Games'
// import dbConnect from '@utils/dbConnect'
import check from 'telegram/func/check'

const setTaskPenalty = async ({ telegramId, jsonCommand }) => {
  // --- НЕ САМОСТОЯТЕЛЬНАЯ КОМАНДА
  const checkData = check(jsonCommand, ['gameId'])
  if (checkData) return checkData

  if (!jsonCommand.message) {
    return {
      success: true,
      message: 'Введите штраф за невыполнение задания в секундах',
      buttons: [
        {
          text: '\u{1F6AB} Отмена',
          c: { c: 'editGame', gameId: jsonCommand.gameId },
        },
      ],
    }
  }
  const value = parseInt(jsonCommand.message)
  const game = await Games.findByIdAndUpdate(jsonCommand.gameId, {
    taskFailurePenalty: value,
  })

  return {
    success: true,
    message: `Штраф за невыполнение задания обновлен на "${secondsToTimeStr(
      value
    )}"`,
    nextCommand: { c: 'editGame', gameId: jsonCommand.gameId },
  }
}

export default setTaskPenalty
