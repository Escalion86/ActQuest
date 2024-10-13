import Games from '@models/Games'

import check from 'telegram/func/check'
import formatGameName from 'telegram/func/formatGameName'

const gameResultShow = async ({ telegramId, jsonCommand }) => {
  // --- НЕ САМОСТОЯТЕЛЬНАЯ КОМАНДА
  const checkData = check(jsonCommand, ['gameId'])
  if (checkData) return checkData

  const game = await Games.findByIdAndUpdate(jsonCommand.gameId, {
    hideResult: false,
  })

  return {
    success: true,
    message: `Результаты игры ${formatGameName(game)} открыты`,
    nextCommand: { c: `editGameGeneral`, gameId: jsonCommand.gameId },
  }
}

export default gameResultShow
