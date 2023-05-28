import Games from '@models/Games'
import dbConnect from '@utils/dbConnect'

const createGameFunc = async (userTelegramId, props) => {
  console.log('createGameFunc props :>> ', props)
  await dbConnect()
  const game = await Games.create(props)
  return game
}

export default createGameFunc
