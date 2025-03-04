import check from 'telegram/func/check'
import formatGameName from 'telegram/func/formatGameName'

const gameTasksShow = async ({ telegramId, jsonCommand, location, db }) => {
  // --- НЕ САМОСТОЯТЕЛЬНАЯ КОМАНДА
  const checkData = check(jsonCommand, ['gameId'])
  if (checkData) return checkData

  const game = await db.model('Games').findByIdAndUpdate(jsonCommand.gameId, {
    showTasks: true,
  })

  return {
    success: true,
    message: `Задания игры ${formatGameName(game)} отображены`,
    nextCommand: { c: `editGameGeneral`, gameId: jsonCommand.gameId },
  }
}

export default gameTasksShow
