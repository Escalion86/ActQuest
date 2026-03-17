import dbConnectGlobal from '@utils/dbConnectGlobal'

const fetchTeam = async (location, teamId) => {
  if (!teamId || !location) return {}
  try {
    const db = await dbConnectGlobal()
    if (!db) return {}

    const fetchResult = await db.model('Teams').findById(teamId).lean()

    return fetchResult
  } catch (error) {
    return {}
  }
}

export default fetchTeam
