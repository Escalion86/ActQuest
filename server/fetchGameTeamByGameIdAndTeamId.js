import dbConnectGlobal from '@utils/dbConnectGlobal'

const fetchGameTeamByGameIdAndTeamId = async (location, gameId, teamId) => {
  if (!gameId || !teamId || !location) return {}
  try {
    const db = await dbConnectGlobal()
    if (!db) return {}

    const fetchResult = await db
      .model('GamesTeams')
      .find({ gameId, teamId })
      .lean()

    return fetchResult
  } catch (error) {
    return {}
  }
}

export default fetchGameTeamByGameIdAndTeamId
