import check from 'telegram/func/check'
import formatGameName from 'telegram/func/formatGameName'

const hideGame = async ({ telegramId, jsonCommand, location, db }) => {
  // --- НЕ САМОСТОЯТЕЛЬНАЯ КОМАНДА
  const checkData = check(jsonCommand, ['gameId'])
  if (checkData) return checkData

  const game = await db.model('Games').findByIdAndUpdate(jsonCommand.gameId, {
    hidden: true,
  })

  return {
    success: true,
    message: `Игра ${formatGameName(game)} скрыта`,
    nextCommand: { c: `editGameGeneral`, gameId: jsonCommand.gameId },
  }
}

export default hideGame
