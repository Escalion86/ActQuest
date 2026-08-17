const toNumberOrNull = (value) => {
  if (value === null || value === undefined || value === '') {
    return null
  }
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
    version: toNumberOrNull(rating.version) ?? 1,
    scope: typeof rating.scope === 'string' ? rating.scope : null,
    scoreDirection:
      rating.scoreDirection === 'desc' || rating.scoreDirection === 'asc'
        ? rating.scoreDirection
        : 'asc',
    isEligible: toBooleanStrict(rating.isEligible),
    rank: toNumberOrNull(rating.rank),
    totalRanked: Number.isFinite(Number(rating.totalRanked))
      ? Number(rating.totalRanked)
      : 0,
    playersAbove: toNumberOrNull(rating.playersAbove),
    finalScore: toNumberOrNull(rating.finalScore),
    ratingPoints: toNumberOrNull(rating.ratingPoints ?? rating.finalScore),
    averageScore: toNumberOrNull(rating.averageScore),
    averagePlace: toNumberOrNull(rating.averagePlace),
    stdDevScore: toNumberOrNull(rating.stdDevScore),
    latestScore: toNumberOrNull(rating.latestScore),
    attendance: toNumberOrNull(rating.attendance),
    wins: Number.isFinite(Number(rating.wins)) ? Number(rating.wins) : 0,
    totalGames: Number.isFinite(Number(rating.totalGames))
      ? Number(rating.totalGames)
      : 0,
    playedGames: Number.isFinite(Number(rating.playedGames))
      ? Number(rating.playedGames)
      : 0,
    missedGames: Number.isFinite(Number(rating.missedGames))
      ? Number(rating.missedGames)
      : 0,
    location: typeof rating.location === 'string' ? normalizeLocation(rating.location) : null,
    seasonId: typeof rating.seasonId === 'string' ? rating.seasonId : null,
    seasonName: typeof rating.seasonName === 'string' ? rating.seasonName : null,
    updatedAt: typeof rating.updatedAt === 'string' ? rating.updatedAt : null,
  }
}

const resolveEntityRating = ({ entity, location = null }) => {
  if (!entity || typeof entity !== 'object') {
    return null
  }

  const normalizedLocation = normalizeLocation(location)
  const globalRating = normalizeRatingSnapshot(entity.rating)
  if (normalizedLocation) {
    const ratingsByLocation =
      entity.ratingsByLocation && typeof entity.ratingsByLocation === 'object'
        ? entity.ratingsByLocation
        : {}
    const locationRating = normalizeRatingSnapshot(
      ratingsByLocation[normalizedLocation],
    )
    if (locationRating?.scope === 'location-all-time') {
      return locationRating
    }
  }

  if (globalRating?.version === 2) {
    return globalRating
  }

  if (globalRating) {
    return globalRating
  }

  return null
}

export default resolveEntityRating
