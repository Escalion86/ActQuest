import GamesTeams from '@models/GamesTeams'
import dbConnect from '@utils/dbConnect'
import mongoose from 'mongoose'

const getGameTeam = async (id) => {
  await dbConnect()
  if (id === undefined || !mongoose.Types.ObjectId.isValid(id))
    return {
      success: false,
      message: 'Ошибка. gameTeamId не указан',
      nextCommand: `mainMenu`,
    }

  const gamesTeams = await GamesTeams.findById(id)
  if (!gamesTeams) {
    return {
      success: false,
      message: 'Ошибка. Нет такого gameTeamId',
      nextCommand: `mainMenu`,
    }
  }
  return gamesTeams
}

export default getGameTeam
