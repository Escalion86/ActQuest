import secondsToTimeStr from '@helpers/secondsToTimeStr'
import Games from '@models/Games'
// import dbConnect from '@utils/dbConnect'
import check from 'telegram/func/check'

const setCluesDuration = async ({ telegramId, jsonCommand }) => {
  // --- НЕ САМОСТОЯТЕЛЬНАЯ КОМАНДА
  const checkData = check(jsonCommand, ['gameId'])
  if (checkData) return checkData

  if (!jsonCommand.message) {
    return {
      success: true,
      message: 'Введите время между подсказками в секундах',
      buttons: [
        {
          text: '\u{1F6AB} Отмена',
          c: { c: 'editGame', gameId: jsonCommand.gameId },
        },
      ],
    }
  }
  // await dbConnect() // TODO: Нужно ли это?
  const value = parseInt(jsonCommand.message)
  const game = await Games.findByIdAndUpdate(jsonCommand.gameId, {
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
