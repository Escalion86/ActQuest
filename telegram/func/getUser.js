import Users from '@models/Users'
import dbConnect from '@utils/dbConnect'
import mongoose from 'mongoose'

const getUser = async (id) => {
  await dbConnect()
  // const preparedId = mongoose.Types.ObjectId(id)
  if (id === undefined || !mongoose.Types.ObjectId.isValid(id))
    return {
      success: false,
      message: 'Ошибка. userId не указан',
      nextCommand: `main_menu`,
    }

  const user = await Users.findById(id)
  if (!user) {
    return {
      success: false,
      message: 'Ошибка. Нет такого userId',
      nextCommand: `main_menu`,
    }
  }
  return user
}

export default getUser
