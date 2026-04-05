const toStringOrEmpty = (value) => {
  if (value === null || value === undefined) {
    return ''
  }

  return String(value)
}

const toBooleanOrDefault = (value, fallback) => {
  if (typeof value === 'boolean') {
    return value
  }

  return fallback
}

const SETTINGS_CITY_KEYS = ['krsk', 'nrsk', 'ekb']

const toLocationMap = (value) => {
  const source =
    value && typeof value === 'object' && !Array.isArray(value) ? value : {}

  return SETTINGS_CITY_KEYS.reduce((acc, key) => {
    const raw = source[key]
    acc[key] = raw === null || raw === undefined ? '' : String(raw)
    return acc
  }, {})
}

const resolvePrimaryFromMap = (map, legacyValue) => {
  const legacy = toStringOrEmpty(legacyValue)
  if (legacy.trim()) {
    return legacy
  }

  for (const key of SETTINGS_CITY_KEYS) {
    const current = toStringOrEmpty(map?.[key])
    if (current.trim()) {
      return current
    }
  }

  return ''
}

const normalizeSiteSettings = (doc = null) => {
  const settings = doc ?? {}
  const supportPhonesByLocation = toLocationMap(settings.supportPhonesByLocation)
  const chatUrlsByLocation = toLocationMap(settings.chatUrlsByLocation)

  return {
    id: settings?._id ? String(settings._id) : null,
    supportPhone: resolvePrimaryFromMap(supportPhonesByLocation, settings.supportPhone),
    chatUrl: resolvePrimaryFromMap(chatUrlsByLocation, settings.chatUrl),
    supportPhonesByLocation,
    chatUrlsByLocation,
    allowSiteAuth: toBooleanOrDefault(settings.allowSiteAuth, true),
    allowSiteRegistration: toBooleanOrDefault(settings.allowSiteRegistration, true),
    enableVkOneTap: toBooleanOrDefault(settings.enableVkOneTap, true),
  }
}

export default normalizeSiteSettings
