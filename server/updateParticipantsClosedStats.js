import { toStringId } from '@helpers/idAndDate'
import { COMPLETED_PARTICIPATION_STATUSES } from '@helpers/gameParticipation'
import {
  buildCompletedParticipationStats,
  buildParticipationSnapshot,
  resolveParticipantStatsKey,
} from '@server/buildCompletedParticipationStats'

const collectCurrentParticipantRefs = (game) => {
  const refs = new Map()
  const teamsUsers = Array.isArray(game?.result?.teamsUsers)
    ? game.result.teamsUsers
    : []

  teamsUsers.forEach((membership) => {
    const userId = toStringId(membership?.userId)
    const telegramId = Number(membership?.userTelegramId)
    const key = resolveParticipantStatsKey({ userId, telegramId })
    if (!key) return

    if (userId) {
      refs.set(key, { _id: userId })
    } else if (Number.isFinite(telegramId) && telegramId > 0) {
      refs.set(key, { telegramId })
    }
  })

  return refs
}

const collectCurrentTeamRefs = (game) => {
  const teamIds = new Set()
  if (game?.participationMode === 'player') {
    return teamIds
  }

  const result =
    game?.result && typeof game.result === 'object' ? game.result : {}

  ;(Array.isArray(result.teams) ? result.teams : []).forEach((team) => {
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
  ;(Array.isArray(result.teamsUsers) ? result.teamsUsers : []).forEach(
    (membership) => {
      const teamId = toStringId(membership?.teamId)
      if (teamId) teamIds.add(teamId)
    },
  )

  return teamIds
}

const updateParticipantsClosedStats = async ({ db, game }) => {
  if (!db || !game) {
    return { usersUpdated: 0, teamsUpdated: 0 }
  }

  const participantRefs = collectCurrentParticipantRefs(game)
  const teamRefs = collectCurrentTeamRefs(game)
  if (participantRefs.size === 0 && teamRefs.size === 0) {
    return { usersUpdated: 0, teamsUpdated: 0 }
  }

  const completedGames = await db
    .model('Games')
    .find({ status: { $in: COMPLETED_PARTICIPATION_STATUSES } })
    .select({
      _id: 1,
      status: 1,
      dateStart: 1,
      dateStartFact: 1,
      updatedAt: 1,
      participationMode: 1,
      result: 1,
    })
    .lean()

  const { userGamesByKey, teamGamesById } =
    buildCompletedParticipationStats(completedGames)
  const nowIso = new Date().toISOString()

  const usersBulkOps = []
  participantRefs.forEach((filter, key) => {
    usersBulkOps.push({
      updateOne: {
        filter,
        update: {
          $set: {
            gameStats: buildParticipationSnapshot({
              gamesById: userGamesByKey.get(key),
              nowIso,
            }),
          },
        },
      },
    })
  })

  const teamsBulkOps = []
  teamRefs.forEach((teamId) => {
    teamsBulkOps.push({
      updateOne: {
        filter: { _id: teamId },
        update: {
          $set: {
            gameStats: buildParticipationSnapshot({
              gamesById: teamGamesById.get(teamId),
              nowIso,
            }),
          },
        },
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
