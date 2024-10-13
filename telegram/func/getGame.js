import Games from '@models/Games'

// import mongoose from 'mongoose'

const getGame = async (id) => {
  if (
    id === undefined
    //  || !mongoose.Types.ObjectId.isValid(id)
  )
    return {
      success: false,
      message: 'Ошибка. gameId не указан',
      nextCommand: `mainMenu`,
    }

  const game = await Games.findById(id).lean()
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
