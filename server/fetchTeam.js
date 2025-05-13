import dbConnect from '@utils/dbConnect'

const fetchTeam = async (location, teamId) => {
  if (!teamId || !location) return {}
  try {
    // const isAdmin = isUserAdmin(user)
    const db = await dbConnect(location)
    if (!db) return {}

    const fetchResult = await db.model('Teams').findById(teamId).lean()

    return fetchResult
  } catch (error) {
    return {}
  }
}

export default fetchTeam
