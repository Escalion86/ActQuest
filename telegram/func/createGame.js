import Games from '@models/Games'
import dbConnect from '@utils/dbConnect'

const createGame = async (userTelegramId, name, description) => {
  await dbConnect()
  const game = await Games.create({
    // capitanId: userTelegramId,
    name,
    description: description ?? '',
  })
  return game
}

export default createGame
