import TeamsUsers from '@models/TeamsUsers'

// import mongoose from 'mongoose'

const getTeamUser = async (id) => {
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

  const teamsUsers = await TeamsUsers.findById(id).lean()
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
