import Games from '@models/Games'
import dbConnect from '@utils/dbConnect'
import mongoose from 'mongoose'

const getGame = async (id) => {
  await dbConnect()
  if (id === undefined || !mongoose.Types.ObjectId.isValid(id))
    return {
      success: false,
      message: 'Ошибка. gameId не указан',
      nextCommand: `main_menu`,
    }

  const game = await Games.findById(id)
  if (!game) {
    return {
      success: false,
      message: 'Ошибка. Нет такого gameId',
      nextCommand: `main_menu`,
    }
  }
  return game
}

export default getGame
