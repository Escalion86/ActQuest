import dbConnect from '@utils/dbConnect'

export const SITE_ACCESS_DEFAULTS = {
  allowSiteAuth: true,
  allowSiteRegistration: true,
  enableVkOneTap: true,
}

const toBooleanOrDefault = (value, fallback) => {
  if (typeof value === 'boolean') return value
  return fallback
}

export const normalizeSiteAccessControls = (doc = null) => ({
  allowSiteAuth: toBooleanOrDefault(
    doc?.allowSiteAuth,
    SITE_ACCESS_DEFAULTS.allowSiteAuth,
  ),
  allowSiteRegistration: toBooleanOrDefault(
    doc?.allowSiteRegistration,
    SITE_ACCESS_DEFAULTS.allowSiteRegistration,
  ),
  enableVkOneTap: toBooleanOrDefault(
    doc?.enableVkOneTap,
    SITE_ACCESS_DEFAULTS.enableVkOneTap,
  ),
})

export const getSiteAccessControlsByLocation = async (location) => {
  if (!location || typeof location !== 'string') {
    return SITE_ACCESS_DEFAULTS
  }

  try {
    const db = await dbConnect(location)
    if (!db) return SITE_ACCESS_DEFAULTS

    const settings = await db
      .model('SiteSettings')
      .findOne({})
      .select({
        allowSiteAuth: 1,
        allowSiteRegistration: 1,
        enableVkOneTap: 1,
      })
      .lean()

    return normalizeSiteAccessControls(settings)
  } catch (error) {
    console.error('Failed to load site access controls', error)
    return SITE_ACCESS_DEFAULTS
  }
}
