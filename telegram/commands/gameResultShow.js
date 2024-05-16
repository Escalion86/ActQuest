import Games from '@models/Games'
import dbConnect from '@utils/dbConnect'
import check from 'telegram/func/check'
import formatGameName from 'telegram/func/formatGameName'

const gameResultShow = async ({ telegramId, jsonCommand }) => {
  // --- НЕ САМОСТОЯТЕЛЬНАЯ КОМАНДА
  const checkData = check(jsonCommand, ['gameId'])
  if (checkData) return checkData

  await dbConnect()
  const game = await Games.findByIdAndUpdate(jsonCommand.gameId, {
    hideResult: false,
  })

  return {
    success: true,
    message: `Результаты игры ${formatGameName(game)} открыты`,
    nextCommand: { c: `editGame`, gameId: jsonCommand.gameId },
  }
}

export default gameResultShow
