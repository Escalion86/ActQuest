const RATING_VERSION = 2
const RATING_MIN_PLAYED_GAMES = 3

const getAverage = (values) =>
  values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : null

const getStdDev = (values, average) => {
  if (!values.length || !Number.isFinite(average)) {
    return 0
  }

  const variance =
    values.reduce((sum, value) => sum + (value - average) ** 2, 0) /
    values.length
  return Math.sqrt(variance)
}

export const calculateRatingGameScore = ({ place, participantsCount }) => {
  const normalizedPlace = Number(place)
  const normalizedParticipantsCount = Number(participantsCount)

  if (
    !Number.isFinite(normalizedPlace) ||
    !Number.isFinite(normalizedParticipantsCount) ||
    normalizedParticipantsCount < 2 ||
    normalizedPlace < 1 ||
    normalizedPlace > normalizedParticipantsCount
  ) {
    return null
  }

  return (
    (100 * (normalizedParticipantsCount - normalizedPlace)) /
    (normalizedParticipantsCount - 1)
  )
}

export const buildRatingMetricsV2 = ({ results = [], totalGames = 0 }) => {
  const normalizedResults = Array.isArray(results)
    ? results
        .map((result) => {
          const place = Number(result?.place)
          const participantsCount = Number(result?.participantsCount)
          const score = calculateRatingGameScore({ place, participantsCount })
          const startedAt = Number(result?.startedAt)

          if (!Number.isFinite(score)) {
            return null
          }

          return {
            gameId: typeof result?.gameId === 'string' ? result.gameId : '',
            place,
            participantsCount,
            score,
            startedAt: Number.isFinite(startedAt)
              ? startedAt
              : Number.NEGATIVE_INFINITY,
          }
        })
        .filter(Boolean)
        .sort((first, second) => {
          if (first.startedAt !== second.startedAt) {
            return first.startedAt - second.startedAt
          }
          return first.gameId.localeCompare(second.gameId, 'ru')
        })
    : []

  const scores = normalizedResults.map((result) => result.score)
  const places = normalizedResults.map((result) => result.place)
  const playedGames = normalizedResults.length
  const averageScore = getAverage(scores)
  const averagePlace = getAverage(places)
  const stdDevScore = getStdDev(scores, averageScore)
  const normalizedTotalGames = Math.max(
    playedGames,
    Number.isFinite(Number(totalGames)) ? Number(totalGames) : 0,
  )
  const missedGames = Math.max(0, normalizedTotalGames - playedGames)
  const attendance = normalizedTotalGames
    ? playedGames / normalizedTotalGames
    : null
  const latestResult = normalizedResults.at(-1) || null

  return {
    version: RATING_VERSION,
    scoreDirection: 'desc',
    results: normalizedResults,
    places,
    scores,
    playedGames,
    totalGames: normalizedTotalGames,
    missedGames,
    attendance,
    wins: normalizedResults.filter((result) => result.place === 1).length,
    averagePlace,
    averageScore,
    stdDevScore,
    latestScore: latestResult?.score ?? null,
    finalScore: averageScore,
    isEligible:
      playedGames >= RATING_MIN_PLAYED_GAMES && Number.isFinite(averageScore),
  }
}

const isSameNumber = (first, second) =>
  Number.isFinite(first) &&
  Number.isFinite(second) &&
  Math.abs(first - second) < 1e-9

const compareEligibleRatings = (first, second) => {
  if (!isSameNumber(first.finalScore, second.finalScore)) {
    return second.finalScore - first.finalScore
  }
  if (first.playedGames !== second.playedGames) {
    return second.playedGames - first.playedGames
  }
  if (first.wins !== second.wins) {
    return second.wins - first.wins
  }
  if (!isSameNumber(first.latestScore, second.latestScore)) {
    return (second.latestScore ?? -1) - (first.latestScore ?? -1)
  }
  return first.key.localeCompare(second.key, 'ru')
}

const hasSameRankMetrics = (first, second) =>
  isSameNumber(first?.finalScore, second?.finalScore) &&
  first?.playedGames === second?.playedGames &&
  first?.wins === second?.wins &&
  isSameNumber(first?.latestScore, second?.latestScore)

export const buildRatingRanksV2 = (rawMetricsByKey, totalGames) => {
  const metricsByKey =
    rawMetricsByKey instanceof Map ? rawMetricsByKey : new Map()
  const rows = Array.from(metricsByKey.entries()).map(([key, results]) => ({
    key,
    ...buildRatingMetricsV2({ results, totalGames }),
  }))
  const eligibleRows = rows
    .filter((row) => row.isEligible)
    .sort(compareEligibleRatings)

  const rankByKey = new Map()
  let previousRow = null
  let previousRank = 0
  eligibleRows.forEach((row, index) => {
    const rank =
      previousRow && hasSameRankMetrics(row, previousRow)
        ? previousRank
        : index + 1
    rankByKey.set(row.key, rank)
    previousRow = row
    previousRank = rank
  })

  return new Map(
    rows.map((row) => {
      const rank = rankByKey.get(row.key) ?? null
      return [
        row.key,
        {
          ...row,
          rank,
          totalRanked: eligibleRows.length,
          playersAbove: Number.isFinite(rank) ? rank - 1 : null,
        },
      ]
    }),
  )
}

export { RATING_MIN_PLAYED_GAMES, RATING_VERSION }

