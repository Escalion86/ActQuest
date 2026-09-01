import dbConnectGlobal from '@utils/dbConnectGlobal'

export const countPendingGameReviews = async () => {
  const db = await dbConnectGlobal()
  if (!db) {
    return 0
  }

  return db.model('GameReviews').countDocuments({
    moderationStatus: 'pending',
  })
}
