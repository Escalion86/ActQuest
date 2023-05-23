import Games from '@models/Games'
import dbConnect from '@utils/dbConnect'

const createGame = async (userTelegramId, props) => {
  await dbConnect()
  const game = await Games.create(props)
  return game
}

export default createGame
