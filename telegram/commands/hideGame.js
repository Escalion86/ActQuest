import Games from '@models/Games'
import dbConnect from '@utils/dbConnect'
import check from 'telegram/func/check'

const hideGame = async ({ telegramId, jsonCommand }) => {
  // --- НЕ САМОСТОЯТЕЛЬНАЯ КОМАНДА
  const checkData = check(jsonCommand, ['gameId'])
  if (checkData) return checkData

  await dbConnect()
  const game = await Games.findByIdAndUpdate(jsonCommand.gameId, {
    hide: true,
  })

  return {
    success: true,
    message: `Игра "${game.name}" скрыта`,
    nextCommand: { cmd: `menuGamesEdit`, gameId: jsonCommand.gameId },
  }
}

export default hideGame
