import check from 'telegram/func/check'
import formatGameName from 'telegram/func/formatGameName'

const gameTasksHide = async ({ telegramId, jsonCommand, location, db }) => {
  // --- НЕ САМОСТОЯТЕЛЬНАЯ КОМАНДА
  const checkData = check(jsonCommand, ['gameId'])
  if (checkData) return checkData

  const game = await db.model('Games').findByIdAndUpdate(jsonCommand.gameId, {
    showTasks: false,
  })

  return {
    success: true,
    message: `Задания игры ${formatGameName(game)} скрыты`,
    nextCommand: { c: `editGameGeneral`, gameId: jsonCommand.gameId },
  }
}

export default gameTasksHide
