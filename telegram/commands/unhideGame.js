import Games from '@models/Games'
// import dbConnect from '@utils/dbConnect'
import check from 'telegram/func/check'
import formatGameName from 'telegram/func/formatGameName'

const unhideGame = async ({ telegramId, jsonCommand }) => {
  // --- НЕ САМОСТОЯТЕЛЬНАЯ КОМАНДА
  const checkData = check(jsonCommand, ['gameId'])
  if (checkData) return checkData

  // await dbConnect() // TODO: Нужно ли это?
  const game = await Games.findByIdAndUpdate(jsonCommand.gameId, {
    hidden: false,
  })

  return {
    success: true,
    message: `Игра ${formatGameName(game)} открыта`,
    nextCommand: { c: `editGame`, gameId: jsonCommand.gameId },
  }
}

export default unhideGame
