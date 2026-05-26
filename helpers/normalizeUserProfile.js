const sanitizeString = (value) => {
  if (value === null || value === undefined) {
    return ''
  }

  return String(value)
}

const sanitizeNullableString = (value) => {
  if (value === null || value === undefined) {
    return null
  }

  const normalized = String(value).trim()
  return normalized.length > 0 ? normalized : null
}

const normalizePreferences = (value) => {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((item) => sanitizeString(item).trim())
    .filter((item) => item.length > 0)
}

const normalizeLocations = (value) => {
  if (!Array.isArray(value)) {
    return []
  }

  return Array.from(
    new Set(
      value
        .map((item) => sanitizeString(item).trim().toLowerCase())
        .filter((item) => item.length > 0),
    ),
  )
}

const normalizeAuthMethod = (value) => {
  const normalized = sanitizeString(value).trim().toLowerCase()
  if (normalized === 'phone' || normalized === 'vk' || normalized === 'telegram') {
    return normalized
  }
  return 'telegram'
}

const normalizeRating = (value) => {
  if (!value || typeof value !== 'object') {
    return null
  }

  const toNumberOrNull = (input) => {
    const numeric = Number(input)
    return Number.isFinite(numeric) ? numeric : null
  }

  return {
    rank: toNumberOrNull(value.rank),
    totalRanked: toNumberOrNull(value.totalRanked),
    finalScore: toNumberOrNull(value.finalScore),
    playedGames: toNumberOrNull(value.playedGames),
    isEligible: Boolean(value.isEligible),
  }
}

const normalizeUserProfile = (doc = null) => {
  const profile = doc ?? {}

  const rawPhone = sanitizeString(profile.phone).trim()
  const phone = rawPhone.length === 0 ? '' : rawPhone.startsWith('+') ? rawPhone : `+${rawPhone}`

  return {
    id: profile?._id ? String(profile._id) : null,
    name: sanitizeString(profile.name),
    username: sanitizeString(profile.username),
    photoUrl: sanitizeString(profile.photoUrl),
    phone,
    about: sanitizeString(profile.about),
    preferences: normalizePreferences(profile.preferences),
    role: sanitizeString(profile.role || 'client').trim().toLowerCase() || 'client',
    canBeGameModerator: Boolean(profile.canBeGameModerator),
    canBeGameAgent: Boolean(profile.canBeGameAgent),
    authMethod: normalizeAuthMethod(profile.authMethod),
    telegramId: sanitizeNullableString(profile.telegramId),
    vkId: sanitizeNullableString(profile.vkId),
    globalUserId: sanitizeNullableString(profile.globalUserId),
    accountLocation: sanitizeNullableString(profile.accountLocation),
    currentLocation: sanitizeNullableString(profile.currentLocation),
    languageCode: sanitizeNullableString(profile.languageCode),
    isPremium: Boolean(profile.isPremium),
    rating: normalizeRating(profile.rating),
    adminEventPushLocations: normalizeLocations(profile.adminEventPushLocations),
  }
}

export default normalizeUserProfile
