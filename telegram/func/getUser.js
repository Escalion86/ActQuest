import Users from '@models/Users'
// import dbConnect from '@utils/dbConnect'
import mongoose from 'mongoose'

const getUser = async (id) => {
  // const preparedId = mongoose.Types.ObjectId(id)
  if (id === undefined || !mongoose.Types.ObjectId.isValid(id))
    return {
      success: false,
      message: 'Ошибка. userId не указан',
      nextCommand: `mainMenu`,
    }

  const user = await Users.findById(id).lean()
  if (!user) {
    return {
      success: false,
      message: 'Ошибка. Нет такого userId',
      nextCommand: `mainMenu`,
    }
  }
  return user
}

export default getUser
