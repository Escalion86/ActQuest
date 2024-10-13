import Games from '@models/Games'

import mongoose from 'mongoose'

const updateGame = async (id, props) => {
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
