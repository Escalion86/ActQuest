const toNumberOrNull = (value) => {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

const toBooleanStrict = (value) => {
  if (typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'number') {
    return value === 1
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true' || normalized === '1') {
      return true
    }
    if (normalized === 'false' || normalized === '0' || normalized === '') {
      return false
    }
  }

  return false
}

const normalizeLocation = (value) => {
  if (typeof value !== 'string') {
    return ''
  }

  return value.trim().toLowerCase()
}

const normalizeRatingSnapshot = (rating) => {
  if (!rating || typeof rating !== 'object') {
    return null
  }

  return {
    isEligible: toBooleanStrict(rating.isEligible),
    rank: toNumberOrNull(rating.rank),
    totalRanked: Number.isFinite(Number(rating.totalRanked))
      ? Number(rating.totalRanked)
      : 0,
    playersAbove: toNumberOrNull(rating.playersAbove),
    finalScore: toNumberOrNull(rating.finalScore),
    playedGames: Number.isFinite(Number(rating.playedGames))
      ? Number(rating.playedGames)
      : 0,
    missedGames: Number.isFinite(Number(rating.missedGames))
      ? Number(rating.missedGames)
      : 0,
    location: typeof rating.location === 'string' ? normalizeLocation(rating.location) : null,
    updatedAt: typeof rating.updatedAt === 'string' ? rating.updatedAt : null,
  }
}

const resolveEntityRating = ({ entity, location = null }) => {
  void location

  if (!entity || typeof entity !== 'object') {
    return null
  }

  const globalRating = normalizeRatingSnapshot(entity.rating)
  if (globalRating) {
    return globalRating
  }

  return null
}

export default resolveEntityRating
