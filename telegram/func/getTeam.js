import Teams from '@models/Teams'
import dbConnect from '@utils/dbConnect'

const getTeam = async (id) => {
  await dbConnect()
  return await Teams.findById(id)
}

export default getTeam
