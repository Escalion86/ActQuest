import GamesTeams from '@models/GamesTeams'
import dbConnect from '@utils/dbConnect'
import mongoose from 'mongoose'

const getGameTeam = async (id) => {
  await dbConnect()
  // const preparedId = mongoose.Types.ObjectId(id)
  if (!mongoose.Types.ObjectId.isValid(id)) return

  return await GamesTeams.findById(id)
}

export default getGameTeam
