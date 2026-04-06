import dbConnectGlobal from '@utils/dbConnectGlobal'

const syncLegacyUserByLocation = async ({
  location,
  findQuery,
  updates,
  setOnInsert = {},
}) => {
  if (!location || !findQuery || !updates) return null

  try {
    const db = await dbConnectGlobal()
    if (!db) return null

    const user = await db
      .model('Users')
      .findOneAndUpdate(
        findQuery,
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
    console.error('Legacy user sync failed', { location, error: error?.message })
    return null
  }
}

export default syncLegacyUserByLocation

