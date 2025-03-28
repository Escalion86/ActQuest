import check from 'telegram/func/check'
import formatGameName from 'telegram/func/formatGameName'

const gameResultHide = async ({ telegramId, jsonCommand, location, db }) => {
  // --- НЕ САМОСТОЯТЕЛЬНАЯ КОМАНДА
  const checkData = check(jsonCommand, ['gameId'])
  if (checkData) return checkData

  const game = await db.model('Games').findByIdAndUpdate(jsonCommand.gameId, {
    hideResult: true,
  })

  return {
    success: true,
    message: `Результаты игры ${formatGameName(game)} скрыты`,
    nextCommand: { c: `editGameGeneral`, gameId: jsonCommand.gameId },
  }
}

export default gameResultHide
