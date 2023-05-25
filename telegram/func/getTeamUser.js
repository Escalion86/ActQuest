import TeamsUsers from '@models/TeamsUsers'
import dbConnect from '@utils/dbConnect'
import mongoose from 'mongoose'

const getTeamUser = async (id) => {
  await dbConnect()
  // const preparedId = mongoose.Types.ObjectId(id)
  if (id === undefined || !mongoose.Types.ObjectId.isValid(id))
    return {
      success: false,
      message: 'Ошибка. teamUserId не указан',
      nextCommand: `main_menu`,
    }

  const teamsUsers = await TeamsUsers.findById(id)
  if (!teamsUsers) {
    return {
      success: false,
      message: 'Ошибка. Нет такого teamUserId',
      nextCommand: `main_menu`,
    }
  }
  return teamsUsers
}

export default getTeamUser
