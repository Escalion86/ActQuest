import mongoose from 'mongoose'

const updateGame = async (id, props, db) => {
  if (id === undefined || !mongoose.Types.ObjectId.isValid(id))
    return {
      success: false,
      message: 'Ошибка. gameId не указан',
      nextCommand: `mainMenu`,
    }

  const game = await db.model('Games').findByIdAndUpdate(id, props)
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
