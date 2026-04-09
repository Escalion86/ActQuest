import { toStringId } from '@helpers/idAndDate'

const RATING_MIN_PLAYED_GAMES = 3
const RATING_STABILITY_WEIGHT = 0.2
const RATING_MISS_PENALTY_WEIGHT = 0.3

const resolveParticipantRatingKey = (userId, telegramId) => {
  if (userId) {
    return `uid:${userId}`
  }
  if (Number.isFinite(telegramId)) {
    return `tg:${telegramId}`
  }
  return null
}

const resolveTeamRatingKey = (teamId) => {
  const normalized = toStringId(teamId)
  return normalized ? `team:${normalized}` : null
}

const getAverage = (values = []) => {
  if (!Array.isArray(values) || values.length === 0) {
    return null
  }

  const sum = values.reduce((acc, value) => acc + value, 0)
  return sum / values.length
}

const getStdDev = (values = [], average = null) => {
  if (!Array.isArray(values) || values.length === 0) {
    return 0
  }

  const avg = Number.isFinite(average) ? average : getAverage(values)
  if (!Number.isFinite(avg)) {
    return 0
  }

  const variance =
    values.reduce((acc, value) => acc + (value - avg) ** 2, 0) / values.length

  return Math.sqrt(variance)
}

const buildRatingMetrics = ({ places = [], missedGames = 0 }) => {
  const normalizedPlaces = Array.isArray(places)
    ? places
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value))
    : []

  const playedGames = normalizedPlaces.length
  const normalizedMissedGames = Number.isFinite(Number(missedGames))
    ? Math.max(0, Number(missedGames))
    : 0
  const averagePlace = playedGames > 0 ? getAverage(normalizedPlaces) : null
  const stdDevPlace =
    playedGames > 0 && Number.isFinite(averagePlace)
      ? getStdDev(normalizedPlaces, averagePlace)
      : 0
  const attendanceDenominator = playedGames + normalizedMissedGames
  const attendance =
    attendanceDenominator > 0 ? playedGames / attendanceDenominator : 1
  const baseScore = Number.isFinite(averagePlace)
    ? averagePlace + RATING_STABILITY_WEIGHT * stdDevPlace
    : null
  const missPenalty = Number.isFinite(baseScore)
    ? (1 - attendance) * RATING_MISS_PENALTY_WEIGHT
    : null
  const finalScore = Number.isFinite(baseScore) ? baseScore + missPenalty : null

  return {
    places: normalizedPlaces,
    playedGames,
    missedGames: normalizedMissedGames,
    averagePlace,
    stdDevPlace,
    attendance,
    baseScore,
    missPenalty,
    finalScore,
    isEligible:
      playedGames >= RATING_MIN_PLAYED_GAMES && Number.isFinite(finalScore),
  }
}

const buildTimeline = (games) =>
  games
    .map((game) => {
      const result =
        game?.result && typeof game.result === 'object' ? game.result : {}
      const teamsPlacesRaw =
        result?.teamsPlaces && typeof result.teamsPlaces === 'object'
          ? result.teamsPlaces
          : {}
      const teamsUsers = Array.isArray(result?.teamsUsers)
        ? result.teamsUsers
        : []

      const teamsPlaces = new Map()
      Object.entries(teamsPlacesRaw).forEach(([teamId, place]) => {
        const key = resolveTeamRatingKey(teamId)
        const numericPlace = Number(place)
        if (key && Number.isFinite(numericPlace)) {
          teamsPlaces.set(key, numericPlace)
        }
      })

      const playersPlaces = new Map()
      teamsUsers.forEach((membership) => {
        const userId = toStringId(membership?.userId)
        const telegramId = Number(membership?.userTelegramId)
        const participantKey = resolveParticipantRatingKey(userId, telegramId)
        if (!participantKey) {
          return
        }

        const teamKey = resolveTeamRatingKey(membership?.teamId)
        if (!teamKey) {
          return
        }

        const place = teamsPlaces.get(teamKey)
        if (!Number.isFinite(place)) {
          return
        }

        const prevPlace = playersPlaces.get(participantKey)
        if (!Number.isFinite(prevPlace) || place < prevPlace) {
          playersPlaces.set(participantKey, place)
        }
      })

      if (!teamsPlaces.size && !playersPlaces.size) {
        return null
      }

      const startedAt = game?.dateStart
        ? new Date(game.dateStart).getTime()
        : Number.NaN

      const seasonId = toStringId(game?.seasonId)

      return {
        id: toStringId(game?._id) || '',
        startedAt: Number.isFinite(startedAt)
          ? startedAt
          : Number.POSITIVE_INFINITY,
        seasonId: seasonId || null,
        teamsPlaces,
        playersPlaces,
      }
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.startedAt !== b.startedAt) {
        return a.startedAt - b.startedAt
      }
      return a.id.localeCompare(b.id, 'ru')
    })

const collectMetrics = (timeline, mapSelector) => {
  const seasonGamesCount = new Map()
  timeline.forEach((item) => {
    const seasonId = toStringId(item?.seasonId)
    if (!seasonId) {
      return
    }
    seasonGamesCount.set(seasonId, (seasonGamesCount.get(seasonId) ?? 0) + 1)
  })

  const rawByKey = new Map()
  timeline.forEach((item) => {
    const seasonId = toStringId(item?.seasonId)
    mapSelector(item).forEach((place, key) => {
      if (!Number.isFinite(place)) {
        return
      }

      if (!rawByKey.has(key)) {
        rawByKey.set(key, {
          places: [],
          playedBySeason: new Map(),
        })
      }

      const row = rawByKey.get(key)
      row.places.push(Number(place))
      if (seasonId) {
        row.playedBySeason.set(
          seasonId,
          (row.playedBySeason.get(seasonId) ?? 0) + 1,
        )
      }
    })
  })

  const metricsByKey = new Map()
  rawByKey.forEach((row, key) => {
    let missedGames = 0
    row.playedBySeason.forEach((playedCount, seasonId) => {
      const totalGamesInSeason = seasonGamesCount.get(seasonId) ?? 0
      if (playedCount > 0 && totalGamesInSeason > playedCount) {
        missedGames += totalGamesInSeason - playedCount
      }
    })

    metricsByKey.set(key, {
      places: row.places,
      missedGames,
    })
  })

  return metricsByKey
}

const buildRanks = (metricsByKey) => {
  const isSameScore = (first, second) => {
    if (!Number.isFinite(first) || !Number.isFinite(second)) {
      return false
    }

    return Math.abs(first - second) < 1e-9
  }

  const rows = Array.from(metricsByKey.entries())
    .map(([key, rawMetrics]) => {
      const metrics = buildRatingMetrics(rawMetrics)
      return {
        key,
        ...metrics,
      }
    })
    .filter((item) => item.playedGames > 0 || item.missedGames > 0)

  const eligibleRows = rows
    .filter((item) => item.isEligible)
    .sort((a, b) => {
      if (a.finalScore !== b.finalScore) {
        return a.finalScore - b.finalScore
      }
      if (a.playedGames !== b.playedGames) {
        return b.playedGames - a.playedGames
      }
      return a.key.localeCompare(b.key, 'ru')
    })

  const rankByKey = new Map()
  let previousScore = null
  let previousRank = 0
  eligibleRows.forEach((item, index) => {
    const currentScore = Number(item.finalScore)
    if (index === 0) {
      previousRank = 1
      previousScore = currentScore
      rankByKey.set(item.key, previousRank)
      return
    }

    if (isSameScore(currentScore, previousScore)) {
      rankByKey.set(item.key, previousRank)
      return
    }

    previousRank = index + 1
    previousScore = currentScore
    rankByKey.set(item.key, previousRank)
  })

  const metricsByKeyResolved = new Map()
  rows.forEach((row) => {
    metricsByKeyResolved.set(row.key, {
      ...row,
      rank: rankByKey.get(row.key) ?? null,
      totalRanked: eligibleRows.length,
      playersAbove: rankByKey.has(row.key) ? rankByKey.get(row.key) - 1 : null,
    })
  })

  return metricsByKeyResolved
}

const buildRatingSnapshot = ({
  rating,
  location,
  sourceGameId,
  entityType,
}) => {
  const nowIso = new Date().toISOString()
  return {
    version: 1,
    entityType,
    location: location || null,
    sourceGameId: sourceGameId || null,
    updatedAt: nowIso,
    isEligible: Boolean(rating?.isEligible),
    rank: Number.isFinite(Number(rating?.rank)) ? Number(rating.rank) : null,
    totalRanked: Number.isFinite(Number(rating?.totalRanked))
      ? Number(rating.totalRanked)
      : 0,
    playersAbove: Number.isFinite(Number(rating?.playersAbove))
      ? Number(rating.playersAbove)
      : null,
    finalScore: Number.isFinite(Number(rating?.finalScore))
      ? Number(rating.finalScore)
      : null,
    baseScore: Number.isFinite(Number(rating?.baseScore))
      ? Number(rating.baseScore)
      : null,
    missPenalty: Number.isFinite(Number(rating?.missPenalty))
      ? Number(rating.missPenalty)
      : null,
    averagePlace: Number.isFinite(Number(rating?.averagePlace))
      ? Number(rating.averagePlace)
      : null,
    stdDevPlace: Number.isFinite(Number(rating?.stdDevPlace))
      ? Number(rating.stdDevPlace)
      : null,
    attendance: Number.isFinite(Number(rating?.attendance))
      ? Number(rating.attendance)
      : null,
    playedGames: Number.isFinite(Number(rating?.playedGames))
      ? Number(rating.playedGames)
      : 0,
    missedGames: Number.isFinite(Number(rating?.missedGames))
      ? Number(rating.missedGames)
      : 0,
  }
}

const updateParticipantsRatings = async ({ db, game }) => {
  if (!db || !game) {
    return { usersUpdated: 0, teamsUpdated: 0 }
  }

  const gameId = toStringId(game?._id)
  const result =
    game?.result && typeof game.result === 'object' ? game.result : {}
  const teamsUsers = Array.isArray(result?.teamsUsers) ? result.teamsUsers : []
  const teamsPlacesRaw =
    result?.teamsPlaces && typeof result.teamsPlaces === 'object'
      ? result.teamsPlaces
      : {}

  const currentUserRefs = new Map()
  teamsUsers.forEach((membership) => {
    const userId = toStringId(membership?.userId)
    const telegramId = Number(membership?.userTelegramId)
    const key = resolveParticipantRatingKey(userId, telegramId)

    if (!key) {
      return
    }

    if (userId) {
      currentUserRefs.set(key, { _id: userId })
      return
    }

    if (Number.isFinite(telegramId)) {
      currentUserRefs.set(key, { telegramId })
    }
  })

  const currentTeamRefs = new Map()
  Object.keys(teamsPlacesRaw).forEach((teamId) => {
    const teamKey = resolveTeamRatingKey(teamId)
    const normalizedTeamId = toStringId(teamId)
    if (teamKey && normalizedTeamId) {
      currentTeamRefs.set(teamKey, normalizedTeamId)
    }
  })

  if (!currentUserRefs.size && !currentTeamRefs.size) {
    return { usersUpdated: 0, teamsUpdated: 0 }
  }

  const gamesQuery = {
    status: 'closed',
    isRated: { $ne: false },
  }

  const ratedGames = await db
    .model('Games')
    .find(gamesQuery)
    .select({
      _id: 1,
      dateStart: 1,
      seasonId: 1,
      result: 1,
    })
    .lean()

  const timeline = buildTimeline(ratedGames)
  if (!timeline.length) {
    return { usersUpdated: 0, teamsUpdated: 0 }
  }

  const playerMetrics = collectMetrics(timeline, (item) => item.playersPlaces)
  const teamMetrics = collectMetrics(timeline, (item) => item.teamsPlaces)
  const playerRatings = buildRanks(playerMetrics)
  const teamRatings = buildRanks(teamMetrics)

  const usersBulkOps = []
  currentUserRefs.forEach((filter, key) => {
    const rating = playerRatings.get(key)
    if (!rating) {
      return
    }

    const snapshot = buildRatingSnapshot({
      rating,
      location: null,
      sourceGameId: gameId,
      entityType: 'player',
    })

    usersBulkOps.push({
      updateOne: {
        filter,
        update: { $set: { rating: snapshot } },
      },
    })
  })

  const teamsBulkOps = []
  currentTeamRefs.forEach((teamId, key) => {
    const rating = teamRatings.get(key)
    if (!rating) {
      return
    }

    const snapshot = buildRatingSnapshot({
      rating,
      location: null,
      sourceGameId: gameId,
      entityType: 'team',
    })

    teamsBulkOps.push({
      updateOne: {
        filter: { _id: teamId },
        update: { $set: { rating: snapshot } },
      },
    })
  })

  if (usersBulkOps.length > 0) {
    await db.model('Users').bulkWrite(usersBulkOps)
  }

  if (teamsBulkOps.length > 0) {
    await db.model('Teams').bulkWrite(teamsBulkOps)
  }

  return {
    usersUpdated: usersBulkOps.length,
    teamsUpdated: teamsBulkOps.length,
  }
}

export default updateParticipantsRatings
