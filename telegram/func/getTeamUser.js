const getTeamUser = async (id, db) => {
  // const preparedId = mongoose.Types.ObjectId(id)
  if (
    id === undefined
    //  || !mongoose.Types.ObjectId.isValid(id)
  )
    return {
      success: false,
      message: 'Ошибка. teamUserId не указан',
      nextCommand: `mainMenu`,
    }

  const teamsUsers = await db.model('TeamsUsers').findById(id).lean()
  if (!teamsUsers) {
    return {
      success: false,
      message: 'Ошибка. Нет такого пользователя в команде',
      nextCommand: `mainMenu`,
    }
  }
  return teamsUsers
}

export default getTeamUser
