import secondsToTimeStr from '@helpers/secondsToTimeStr'
import check from 'telegram/func/check'

const setTaskDuration = async ({ telegramId, jsonCommand, location, db }) => {
  // --- НЕ САМОСТОЯТЕЛЬНАЯ КОМАНДА
  const checkData = check(jsonCommand, ['gameId'])
  if (checkData) return checkData

  if (!jsonCommand.message) {
    return {
      success: true,
      message: 'Введите продолжительность задания игры в секундах',
      buttons: [
        {
          text: '\u{1F6AB} Отмена',
          c: { c: 'editGame', gameId: jsonCommand.gameId },
        },
      ],
    }
  }
  const value = parseInt(jsonCommand.message)
  const game = await db.model('Games').findByIdAndUpdate(jsonCommand.gameId, {
    taskDuration: value,
  })

  return {
    success: true,
    message: `Продолжительность задания игры обновлено на "${secondsToTimeStr(
      value
    )}"`,
    nextCommand: { c: 'editGame', gameId: jsonCommand.gameId },
  }
}

export default setTaskDuration
