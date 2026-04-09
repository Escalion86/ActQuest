import dbConnectGlobal from '@utils/dbConnectGlobal'

const syncLegacyUserByLocation = async ({
  location,
  findQuery,
  updates,
  setOnInsert = {},
  globalUserId = null,
}) => {
  if (!location || !updates) return null
  if (!globalUserId && !findQuery) return null

  try {
    const db = await dbConnectGlobal()
    if (!db) return null

    // Если известен globalUserId — ищем строго по _id (без риска дубликатов)
    const query = globalUserId ? { _id: globalUserId } : findQuery

    const user = await db
      .model('Users')
      .findOneAndUpdate(
        query,
        {
          $set: updates,
          $setOnInsert: {
            location: null,
            role: 'client',
            telegramId: null,
            vkId: null,
            phone: null,
            ...setOnInsert,
          },
        },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
      )
      .lean()

    return user
  } catch (error) {
    console.error('Legacy user sync failed', {
      location,
      error: error?.message,
    })
    return null
  }
}

export default syncLegacyUserByLocation
