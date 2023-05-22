import TeamsUsers from '@models/TeamsUsers'
import dbConnect from '@utils/dbConnect'
import mongoose from 'mongoose'

const getTeamUser = async (id) => {
  await dbConnect()
  // const preparedId = mongoose.Types.ObjectId(id)
  if (!mongoose.Types.ObjectId.isValid(id)) return

  return await TeamsUsers.findById(id)
}

export default getTeamUser
