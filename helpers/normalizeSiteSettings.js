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

const normalizeSiteSettings = (doc = null) => {
  const settings = doc ?? {}

  return {
    id: settings?._id ? String(settings._id) : null,
    supportPhone: toStringOrEmpty(settings.supportPhone),
    chatUrl: toStringOrEmpty(settings.chatUrl),
    allowSiteAuth: toBooleanOrDefault(settings.allowSiteAuth, true),
    allowSiteRegistration: toBooleanOrDefault(settings.allowSiteRegistration, true),
    enableVkOneTap: toBooleanOrDefault(settings.enableVkOneTap, true),
  }
}

export default normalizeSiteSettings
