import secondsToTimeStr from '@helpers/secondsToTimeStr'
import check from 'telegram/func/check'

const setCluesDuration = async ({ telegramId, jsonCommand, location, db }) => {
  // --- НЕ САМОСТОЯТЕЛЬНАЯ КОМАНДА
  const checkData = check(jsonCommand, ['gameId'])
  if (checkData) return checkData

  if (!jsonCommand.message) {
    return {
      success: true,
      message: 'Введите время между подсказками в секундах',
      buttons: [
        {
          text: 'Без подсказок',
          c: { message: '0' },
        },
        {
          text: '\u{1F6AB} Отмена',
          c: { c: 'editGame', gameId: jsonCommand.gameId },
        },
      ],
    }
  }
  const value = parseInt(jsonCommand.message)
  const game = await db.model('Games').findByIdAndUpdate(jsonCommand.gameId, {
    cluesDuration: value,
  })

  return {
    success: true,
    message: `Время между подсказками обновлено на "${secondsToTimeStr(
      value
    )}"`,
    nextCommand: { c: 'editGame', gameId: jsonCommand.gameId },
  }
}

export default setCluesDuration
