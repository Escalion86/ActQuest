import Teams from '@models/Teams'
import dbConnect from '@utils/dbConnect'
import mongoose from 'mongoose'

const getTeam = async (id) => {
  await dbConnect()
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

  const teams = await Teams.findById(id)
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
