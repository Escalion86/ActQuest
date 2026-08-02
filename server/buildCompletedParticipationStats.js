import { toStringId } from '../helpers/idAndDate.js'
import {
  isCompletedParticipationStatus,
  resolveParticipationPlace,
} from '../helpers/gameParticipation.js'

export const resolveParticipantStatsKey = ({ userId, telegramId }) => {
  const normalizedUserId = toStringId(userId)
  if (normalizedUserId) {
    return `uid:${normalizedUserId}`
  }

  const normalizedTelegramId = Number(telegramId)
  return Number.isFinite(normalizedTelegramId) && normalizedTelegramId > 0
    ? `tg:${normalizedTelegramId}`
    : null
}

const resolveGameDate = (game) => {
  const value =
    game?.dateStart || game?.dateStartFact || game?.updatedAt || null
  const date = value ? new Date(value) : null
  return date && !Number.isNaN(date.getTime()) ? date.toISOString() : null
}

const addGameParticipation = ({ map, key, gameId, place, startedAtIso }) => {
  if (!key || !gameId || !Number.isFinite(place) || place <= 0) {
    return
  }

  if (!map.has(key)) {
    map.set(key, new Map())
  }

  const gamesById = map.get(key)
  const previous = gamesById.get(gameId)
  if (!previous || place < previous.place) {
    gamesById.set(gameId, { place, startedAtIso })
  }
}

export const buildParticipationSnapshot = ({ gamesById, nowIso }) => {
  const items = gamesById instanceof Map ? Array.from(gamesById.values()) : []
  let winsCount = 0
  let podiumCount = 0
  let lastPlayedAt = null

  items.forEach((item) => {
    if (item.place === 1) {
      winsCount += 1
    }
    if (item.place <= 3) {
      podiumCount += 1
    }
    if (
      item.startedAtIso &&
      (!lastPlayedAt || item.startedAtIso > lastPlayedAt)
    ) {
      lastPlayedAt = item.startedAtIso
    }
  })

  return {
    version: 1,
    updatedAt: nowIso,
    playedGamesCount: items.length,
    winsCount,
    podiumCount,
    lastPlayedAt,
  }
}

export const buildCompletedParticipationStats = (games) => {
  const userGamesByKey = new Map()
  const teamGamesById = new Map()
  const diagnostics = {
    gamesScanned: 0,
    gamesSkippedByStatus: 0,
    membershipsWithoutIdentity: 0,
    membershipsWithoutTeam: 0,
  }

  ;(Array.isArray(games) ? games : []).forEach((game) => {
    if (!isCompletedParticipationStatus(game?.status)) {
      diagnostics.gamesSkippedByStatus += 1
      return
    }

    diagnostics.gamesScanned += 1
    const gameId = toStringId(game?._id ?? game?.id)
    if (!gameId) {
      return
    }

    const result =
      game?.result && typeof game.result === 'object' ? game.result : {}
    const teamsUsers = Array.isArray(result.teamsUsers) ? result.teamsUsers : []
    const resultTeams = Array.isArray(result.teams) ? result.teams : []
    const teamIds = new Set()

    resultTeams.forEach((team) => {
      const teamId = toStringId(team?._id ?? team?.id ?? team?.teamId)
      if (teamId) teamIds.add(teamId)
    })
    Object.keys(
      result.teamsPlaces && typeof result.teamsPlaces === 'object'
        ? result.teamsPlaces
        : {},
    ).forEach((teamId) => {
      const normalizedTeamId = toStringId(teamId)
      if (normalizedTeamId) teamIds.add(normalizedTeamId)
    })
    teamsUsers.forEach((membership) => {
      const teamId = toStringId(membership?.teamId)
      if (teamId) teamIds.add(teamId)
    })

    const startedAtIso = resolveGameDate(game)
    const placeByTeamId = new Map()
    const tracksTeamStats = game?.participationMode !== 'player'
    teamIds.forEach((teamId) => {
      const place = resolveParticipationPlace({ game, teamIds: [teamId] })
      placeByTeamId.set(teamId, place)
      if (tracksTeamStats) {
        addGameParticipation({
          map: teamGamesById,
          key: teamId,
          gameId,
          place,
          startedAtIso,
        })
      }
    })

    teamsUsers.forEach((membership) => {
      const participantKey = resolveParticipantStatsKey({
        userId: membership?.userId,
        telegramId: membership?.userTelegramId,
      })
      if (!participantKey) {
        diagnostics.membershipsWithoutIdentity += 1
        return
      }

      const teamId = toStringId(membership?.teamId)
      if (!teamId) {
        diagnostics.membershipsWithoutTeam += 1
        return
      }

      addGameParticipation({
        map: userGamesByKey,
        key: participantKey,
        gameId,
        place: placeByTeamId.get(teamId),
        startedAtIso,
      })
    })
  })

  return { userGamesByKey, teamGamesById, diagnostics }
}
