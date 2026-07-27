import { toStringId } from './idAndDate.js'

export const COMPLETED_PARTICIPATION_STATUSES = ['finished', 'closed']

export const isCompletedParticipationStatus = (status) =>
  COMPLETED_PARTICIPATION_STATUSES.includes(
    typeof status === 'string' ? status.trim().toLowerCase() : '',
  )

export const resolveParticipationMetricsTransition = ({
  previousStatus,
  nextStatus,
}) => {
  const previousNormalized =
    typeof previousStatus === 'string'
      ? previousStatus.trim().toLowerCase()
      : ''
  const nextNormalized =
    typeof nextStatus === 'string' ? nextStatus.trim().toLowerCase() : ''

  return {
    shouldUpdateParticipationStats:
      isCompletedParticipationStatus(previousNormalized) !==
      isCompletedParticipationStatus(nextNormalized),
    shouldUpdateRatings:
      (previousNormalized === 'closed') !== (nextNormalized === 'closed'),
  }
}

const resolveResultTeamId = (team) =>
  toStringId(team?._id ?? team?.id ?? team?.teamId)

export const buildResultTeamNameMap = (teams) =>
  (Array.isArray(teams) ? teams : []).reduce((acc, team) => {
    const teamId = resolveResultTeamId(team)
    if (teamId) {
      acc[teamId] =
        typeof team?.name === 'string' && team.name.trim()
          ? team.name.trim()
          : 'Без названия'
    }
    return acc
  }, {})

export const collectSnapshotTeamIdsForUser = ({ game, userId }) => {
  const normalizedUserId = toStringId(userId)
  if (!normalizedUserId) {
    return []
  }

  const teamsUsers = Array.isArray(game?.result?.teamsUsers)
    ? game.result.teamsUsers
    : []
  const teamIds = new Set()

  teamsUsers.forEach((membership) => {
    if (toStringId(membership?.userId) !== normalizedUserId) {
      return
    }

    const teamId = toStringId(membership?.teamId)
    if (teamId) {
      teamIds.add(teamId)
    }
  })

  return Array.from(teamIds)
}

export const resolveUserParticipationTeams = ({
  game,
  userId,
  currentParticipation = [],
}) => {
  const currentTeams = Array.isArray(currentParticipation)
    ? currentParticipation
    : []
  const teamsUsers = Array.isArray(game?.result?.teamsUsers)
    ? game.result.teamsUsers
    : []

  if (!isCompletedParticipationStatus(game?.status) || teamsUsers.length === 0) {
    return currentTeams
  }

  const snapshotTeamIds = collectSnapshotTeamIdsForUser({ game, userId })
  const snapshotTeamNames = buildResultTeamNameMap(game?.result?.teams)

  return snapshotTeamIds.map((teamId) => {
    const currentTeam = currentTeams.find(
      (team) => toStringId(team?.teamId) === teamId,
    )
    return {
      ...(currentTeam || {}),
      teamId,
      teamName:
        snapshotTeamNames[teamId] || currentTeam?.teamName || 'Без названия',
      isCaptain: Boolean(currentTeam?.isCaptain),
    }
  })
}

export const resolveParticipationPlace = ({ game, teamIds }) => {
  const normalizedTeamIds = Array.from(
    new Set(
      (Array.isArray(teamIds) ? teamIds : [])
        .map((teamId) => toStringId(teamId))
        .filter(Boolean),
    ),
  )

  if (normalizedTeamIds.length === 0) {
    return null
  }

  const teamsPlaces =
    game?.result?.teamsPlaces && typeof game.result.teamsPlaces === 'object'
      ? game.result.teamsPlaces
      : {}
  const places = normalizedTeamIds
    .map((teamId) => Number(teamsPlaces[teamId]))
    .filter((place) => Number.isFinite(place) && place > 0)

  if (places.length > 0) {
    return Math.min(...places)
  }

  const resultTeamsCount = Array.isArray(game?.result?.teams)
    ? game.result.teams.length
    : 0
  return Math.max(resultTeamsCount, 1)
}
