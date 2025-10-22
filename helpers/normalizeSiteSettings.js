const toStringOrEmpty = (value) => {
  if (value === null || value === undefined) {
    return ''
  }

  return String(value)
}

const normalizeSiteSettings = (doc = null) => {
  const settings = doc ?? {}

  return {
    id: settings?._id ? String(settings._id) : null,
    supportPhone: toStringOrEmpty(settings.supportPhone),
    announcement: toStringOrEmpty(settings.announcement),
    chatUrl: toStringOrEmpty(settings.chatUrl),
  }
}

export default normalizeSiteSettings
