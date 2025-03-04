const getGameTeam = async (id, db) => {
  if (
    id === undefined
    //  || !mongoose.Types.ObjectId.isValid(id)
  )
    return {
      success: false,
      message: 'Ошибка. gameTeamId не указан',
      nextCommand: `mainMenu`,
    }

  const gamesTeams = await db.model('GamesTeams').findById(id).lean()
  if (!gamesTeams) {
    return {
      success: false,
      message: 'Ошибка. Нет такой регистрации',
      nextCommand: `mainMenu`,
    }
  }
  return gamesTeams
}

export default getGameTeam
