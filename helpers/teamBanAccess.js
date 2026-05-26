const normalizeRole = (value) =>
  typeof value === 'string' ? value.trim().toLowerCase() : ''

export const isBannedSystemRole = (role) => normalizeRole(role) === 'ban'

export const canCreateTeamForRole = (role) => !isBannedSystemRole(role)

export const canJoinTeamForRole = (role) => !isBannedSystemRole(role)

export const canAddTargetUserToTeam = ({ actorRole, targetRole }) => {
  if (isBannedSystemRole(targetRole)) {
    return false
  }

  return ['admin', 'dev'].includes(normalizeRole(actorRole))
}

