import GamesTeams from '@models/GamesTeams'
// import dbConnect from '@utils/dbConnect'
// import mongoose from 'mongoose'

const getGameTeam = async (id) => {
  if (
    id === undefined
    //  || !mongoose.Types.ObjectId.isValid(id)
  )
    return {
      success: false,
      message: 'Ошибка. gameTeamId не указан',
      nextCommand: `mainMenu`,
    }

  const gamesTeams = await GamesTeams.findById(id).lean()
  if (!gamesTeams) {
    return {
      success: false,
      message: 'Ошибка. Нет такой регистрации',
      nextCommand: `mainMenu`,
    }
  }
  return gamesTeams
}

export default getGameTeam
