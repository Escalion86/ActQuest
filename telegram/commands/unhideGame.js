import Games from '@models/Games'
import dbConnect from '@utils/dbConnect'
import check from 'telegram/func/check'

const unhideGame = async ({ telegramId, jsonCommand }) => {
  // --- НЕ САМОСТОЯТЕЛЬНАЯ КОМАНДА
  const checkData = check(jsonCommand, ['gameId'])
  if (checkData) return checkData

  await dbConnect()
  const game = await Games.findByIdAndUpdate(jsonCommand.gameId, {
    hide: false,
  })

  return {
    success: true,
    message: `Игра "${game.name}" открыта`,
    nextCommand: { cmd: `editGame`, gameId: jsonCommand.gameId },
  }
}

export default unhideGame
