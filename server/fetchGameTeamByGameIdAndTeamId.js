import dbConnect from '@utils/dbConnect'

const fetchGameTeamByGameIdAndTeamId = async (location, gameId, teamId) => {
  if (!gameId || !teamId || !location) return {}
  console.log('test :>> ')
  try {
    // const isAdmin = isUserAdmin(user)
    const db = await dbConnect(location)
    if (!db) return {}

    const fetchResult = await db
      .model('GamesTeams')
      .find({ gameId, teamId })
      .lean()
    console.log('fetchResult :>> ', fetchResult)

    return fetchResult
  } catch (error) {
    return {}
  }
}

export default fetchGameTeamByGameIdAndTeamId
