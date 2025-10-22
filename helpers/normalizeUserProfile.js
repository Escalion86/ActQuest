const sanitizeString = (value) => {
  if (value === null || value === undefined) {
    return ''
  }

  return String(value)
}

const normalizePreferences = (value) => {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((item) => sanitizeString(item).trim())
    .filter((item) => item.length > 0)
}

const normalizeUserProfile = (doc = null) => {
  const profile = doc ?? {}

  const rawPhone = sanitizeString(profile.phone).trim()
  const phone = rawPhone.length === 0 ? '' : rawPhone.startsWith('+') ? rawPhone : `+${rawPhone}`

  return {
    id: profile?._id ? String(profile._id) : null,
    name: sanitizeString(profile.name),
    username: sanitizeString(profile.username),
    phone,
    about: sanitizeString(profile.about),
    preferences: normalizePreferences(profile.preferences),
  }
}

export default normalizeUserProfile
