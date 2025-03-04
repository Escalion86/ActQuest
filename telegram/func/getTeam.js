const getTeam = async (id, db) => {
  // const preparedId = mongoose.Types.ObjectId(id)
  if (
    id === undefined
    //  || !mongoose.Types.ObjectId.isValid(id)
  )
    return {
      success: false,
      message: 'Ошибка. teamId не указан',
      nextCommand: `mainMenu`,
    }

  const teams = await db.model('Teams').findById(id).lean()
  if (!teams) {
    return {
      success: false,
      message: 'Ошибка. Нет такого id команды',
      nextCommand: `mainMenu`,
    }
  }
  return teams
}

export default getTeam
