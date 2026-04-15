const normalizeLocationKey = (value) => {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim().toLowerCase()
  return normalized || null
}

const resolveUserCityKey = (user, fallback = null) => {
  if (!user || typeof user !== 'object') {
    return normalizeLocationKey(fallback)
  }

  const candidates = [
    user.currentLocation,
    user.accountLocation,
    user.location,
    fallback,
  ]

  for (const candidate of candidates) {
    const normalized = normalizeLocationKey(candidate)
    if (normalized) {
      return normalized
    }
  }

  return null
}

export default resolveUserCityKey

