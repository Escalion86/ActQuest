import Games from '@models/Games'
// import dbConnect from '@utils/dbConnect'
import check from 'telegram/func/check'
import formatGameName from 'telegram/func/formatGameName'

const gameResultHide = async ({ telegramId, jsonCommand }) => {
  // --- НЕ САМОСТОЯТЕЛЬНАЯ КОМАНДА
  const checkData = check(jsonCommand, ['gameId'])
  if (checkData) return checkData

  const game = await Games.findByIdAndUpdate(jsonCommand.gameId, {
    hideResult: true,
  })

  return {
    success: true,
    message: `Результаты игры ${formatGameName(game)} скрыты`,
    nextCommand: { c: `editGame`, gameId: jsonCommand.gameId },
  }
}

export default gameResultHide
