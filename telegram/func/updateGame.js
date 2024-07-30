import Games from '@models/Games'
// import dbConnect from '@utils/dbConnect'
import mongoose from 'mongoose'

const updateGame = async (id, props) => {
  // await dbConnect() // TODO: Нужно ли это?
  if (id === undefined || !mongoose.Types.ObjectId.isValid(id))
    return {
      success: false,
      message: 'Ошибка. gameId не указан',
      nextCommand: `mainMenu`,
    }

  const game = await Games.findByIdAndUpdate(id, props)
  if (!game) {
    return {
      success: false,
      message: 'Ошибка. Нет такого gameId',
      nextCommand: `mainMenu`,
    }
  }
  return game
}

export default updateGame
