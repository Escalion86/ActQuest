import Teams from '@models/Teams'
import dbConnect from '@utils/dbConnect'
import mongoose from 'mongoose'

const getTeam = async (id) => {
  await dbConnect()
  const preparedId = mongoose.Types.ObjectId(id)
  return await Teams.findById(preparedId, null, (err) => {
    console.log('err :>> ', err)
  })
}

export default getTeam
