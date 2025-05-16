import dbConnect from '@utils/dbConnect'

const fetchGame = async (location, gameId) => {
  if (!gameId || !location) return {}
  try {
    // const isAdmin = isUserAdmin(user)
    const db = await dbConnect(location)
    if (!db) return {}

    const fetchResult = await db.model('Games').findById(gameId).lean()

    return fetchResult
  } catch (error) {
    return {}
  }
}

export default fetchGame
