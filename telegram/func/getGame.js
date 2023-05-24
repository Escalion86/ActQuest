import Games from '@models/Games'
import dbConnect from '@utils/dbConnect'
import mongoose from 'mongoose'

const getGame = async (id) => {
  await dbConnect()
  // const preparedId = mongoose.Types.ObjectId(id)
  if (!mongoose.Types.ObjectId.isValid(id)) return

  return await Games.findById(id)
}

export default getGame
