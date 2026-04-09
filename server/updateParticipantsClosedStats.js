import { toStringId } from '@helpers/idAndDate'

const resolveParticipantKey = ({ userId, telegramId }) => {
  if (userId) {
    return `uid:${userId}`
  }
  if (Number.isFinite(telegramId)) {
    return `tg:${telegramId}`
  }
  return null
}

const resolveTeamKey = (teamId) => {
  const normalized = toStringId(teamId)
  return normalized ? `team:${normalized}` : null
}

const buildClosedTimeline = (games) =>
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
        const key = resolveTeamKey(teamId)
        const numericPlace = Number(place)
        if (key && Number.isFinite(numericPlace)) {
          teamsPlaces.set(key, numericPlace)
        }
      })

      const playersPlaces = new Map()
      teamsUsers.forEach((membership) => {
        const userId = toStringId(membership?.userId)
        const telegramId = Number(membership?.userTelegramId)
        const participantKey = resolveParticipantKey({ userId, telegramId })
        if (!participantKey) {
          return
        }

        const teamKey = resolveTeamKey(membership?.teamId)
        const place = teamKey ? teamsPlaces.get(teamKey) : null
        if (!Number.isFinite(place)) {
          return
        }

        const previousPlace = playersPlaces.get(participantKey)
        if (!Number.isFinite(previousPlace) || place < previousPlace) {
          playersPlaces.set(participantKey, place)
        }
      })

      if (!teamsPlaces.size && !playersPlaces.size) {
        return null
      }

      const startedAt =
        game?.dateStart || game?.dateStartFact || game?.updatedAt || null
      const startedAtTime = startedAt
        ? new Date(startedAt).getTime()
        : Number.NaN

      return {
        id: toStringId(game?._id) || '',
        startedAtTime: Number.isFinite(startedAtTime)
          ? startedAtTime
          : Number.NEGATIVE_INFINITY,
        startedAtIso: Number.isFinite(startedAtTime)
          ? new Date(startedAtTime).toISOString()
          : null,
        teamsPlaces,
        playersPlaces,
      }
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.startedAtTime !== b.startedAtTime) {
        return a.startedAtTime - b.startedAtTime
      }
      return a.id.localeCompare(b.id, 'ru')
    })

const buildParticipationSnapshot = ({ placeByGame, nowIso }) => {
  let playedGamesCount = 0
  let winsCount = 0
  let podiumCount = 0
  let lastPlayedAt = null

  placeByGame.forEach((item) => {
    const place = Number(item?.place)
    if (!Number.isFinite(place)) {
      return
    }

    playedGamesCount += 1
    if (place === 1) {
      winsCount += 1
    }
    if (place <= 3) {
      podiumCount += 1
    }

    if (typeof item?.startedAtIso === 'string') {
      if (
        !lastPlayedAt ||
        new Date(item.startedAtIso) > new Date(lastPlayedAt)
      ) {
        lastPlayedAt = item.startedAtIso
      }
    }
  })

  return {
    version: 1,
    updatedAt: nowIso,
    playedGamesCount,
    winsCount,
    podiumCount,
    lastPlayedAt,
  }
}

const updateParticipantsClosedStats = async ({ db, game }) => {
  if (!db || !game) {
    return { usersUpdated: 0, teamsUpdated: 0 }
  }

  const result =
    game?.result && typeof game.result === 'object' ? game.result : {}
  const teamsUsers = Array.isArray(result?.teamsUsers) ? result.teamsUsers : []
  const teamsPlacesRaw =
    result?.teamsPlaces && typeof result?.teamsPlaces === 'object'
      ? result.teamsPlaces
      : {}

  const participantRefs = new Map()
  teamsUsers.forEach((membership) => {
    const userId = toStringId(membership?.userId)
    const telegramId = Number(membership?.userTelegramId)
    const key = resolveParticipantKey({ userId, telegramId })
    if (!key) {
      return
    }

    if (userId) {
      participantRefs.set(key, { _id: userId })
      return
    }

    if (Number.isFinite(telegramId)) {
      participantRefs.set(key, { telegramId })
    }
  })

  const teamRefs = new Map()
  Object.keys(teamsPlacesRaw).forEach((teamId) => {
    const key = resolveTeamKey(teamId)
    const normalizedTeamId = toStringId(teamId)
    if (key && normalizedTeamId) {
      teamRefs.set(key, normalizedTeamId)
    }
  })

  if (!participantRefs.size && !teamRefs.size) {
    return { usersUpdated: 0, teamsUpdated: 0 }
  }

  const closedGames = await db
    .model('Games')
    .find({ status: 'closed' })
    .select({
      _id: 1,
      dateStart: 1,
      dateStartFact: 1,
      updatedAt: 1,
      result: 1,
    })
    .lean()

  const timeline = buildClosedTimeline(closedGames)
  const nowIso = new Date().toISOString()

  const usersBulkOps = []
  participantRefs.forEach((filter, key) => {
    const placeByGame = []
    timeline.forEach((entry) => {
      const place = entry.playersPlaces.get(key)
      if (Number.isFinite(place)) {
        placeByGame.push({
          place: Number(place),
          startedAtIso: entry.startedAtIso,
        })
      }
    })

    const snapshot = buildParticipationSnapshot({ placeByGame, nowIso })
    usersBulkOps.push({
      updateOne: {
        filter,
        update: { $set: { gameStats: snapshot } },
      },
    })
  })

  const teamsBulkOps = []
  teamRefs.forEach((teamId, key) => {
    const placeByGame = []
    timeline.forEach((entry) => {
      const place = entry.teamsPlaces.get(key)
      if (Number.isFinite(place)) {
        placeByGame.push({
          place: Number(place),
          startedAtIso: entry.startedAtIso,
        })
      }
    })

    const snapshot = buildParticipationSnapshot({ placeByGame, nowIso })
    teamsBulkOps.push({
      updateOne: {
        filter: { _id: teamId },
        update: { $set: { gameStats: snapshot } },
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

export default updateParticipantsClosedStats
