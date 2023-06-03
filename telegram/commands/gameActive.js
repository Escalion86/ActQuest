import Games from '@models/Games'
import check from 'telegram/func/check'
import formatGameName from 'telegram/func/formatGameName'
import getGame from 'telegram/func/getGame'

const gameActive = async ({ telegramId, jsonCommand }) => {
  const checkData = check(jsonCommand, ['gameId'])
  if (checkData) return checkData

  const game = await getGame(jsonCommand.gameId)
  if (game.success === false) return game

  await Games.findByIdAndUpdate(jsonCommand.gameId, {
    status: 'active',
  })

  return {
    message: `Игра ${formatGameName(game)} активирована.`,
    nextCommand: { c: 'editGame', gameId: jsonCommand.gameId },
  }
}

export default gameActive
