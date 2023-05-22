import Users from '@models/Users'
import dbConnect from '@utils/dbConnect'
import mongoose from 'mongoose'

const getUser = async (id) => {
  await dbConnect()
  // const preparedId = mongoose.Types.ObjectId(id)
  if (!mongoose.Types.ObjectId.isValid(id)) return

  return await Users.findById(id)
}

export default getUser
