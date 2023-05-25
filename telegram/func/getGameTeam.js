import GamesTeams from '@models/GamesTeams'
import dbConnect from '@utils/dbConnect'
import mongoose from 'mongoose'

const getGameTeam = async (id) => {
  await dbConnect()
  if (id === undefined || !mongoose.Types.ObjectId.isValid(id))
    return {
      success: false,
      message: 'Ошибка. gameTeamId не указан',
      nextCommand: `main_menu`,
    }

  const gamesTeams = await GamesTeams.findById(id)
  if (!gamesTeams) {
    return {
      success: false,
      message: 'Ошибка. Нет такого gameTeamId',
      nextCommand: `main_menu`,
    }
  }
  return gamesTeams
}

export default getGameTeam
