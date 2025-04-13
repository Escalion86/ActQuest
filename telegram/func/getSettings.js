const getSettings = async (db) => {
  const settingsBase = await db.model('SiteSettings').find({}).lean()
  const settings = settingsBase ? settingsBase[0] : {}

  return settings
}

export default getSettings
