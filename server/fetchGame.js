import dbConnectGlobal from '@utils/dbConnectGlobal'

const fetchGame = async (location, gameId) => {
  if (!gameId || !location) return {}
  try {
    const db = await dbConnectGlobal()
    if (!db) return {}

    const normalizedLocation =
      typeof location === 'string' ? location.trim().toLowerCase() : ''

    if (!normalizedLocation) return {}

    const fetchResult = await db
      .model('Games')
      .findOne({ _id: gameId, location: normalizedLocation })
      .lean()

    return fetchResult
  } catch (error) {
    return {}
  }
}

export default fetchGame
