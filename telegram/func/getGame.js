import Games from '@models/Games'
import dbConnect from '@utils/dbConnect'
import mongoose from 'mongoose'

const getGame = async (id) => {
  await dbConnect()
  if (
    id === undefined
    //  || !mongoose.Types.ObjectId.isValid(id)
  )
    return {
      success: false,
      message: 'Ошибка. gameId не указан',
      nextCommand: `mainMenu`,
    }

  const game = await Games.findById(id)
  if (!game) {
    return {
      success: false,
      message: 'Ошибка. Нет такого id игры',
      nextCommand: `mainMenu`,
    }
  }
  return game
}

export default getGame
