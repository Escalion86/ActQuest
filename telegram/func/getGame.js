const getGame = async (id, db) => {
  if (
    id === undefined
    //  || !mongoose.Types.ObjectId.isValid(id)
  )
    return {
      success: false,
      message: 'Ошибка. gameId не указан',
      nextCommand: `mainMenu`,
    }

  const game = await db.model('Games').findById(id).lean()
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
