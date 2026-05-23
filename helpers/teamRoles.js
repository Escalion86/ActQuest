export const TEAM_ROLE_CAPTAIN = 'captain'
export const TEAM_ROLE_LIAISON = 'liaison'
export const TEAM_ROLE_PARTICIPANT = 'participant'

export const isCaptainRole = (value) => {
  if (typeof value !== 'string') {
    return false
  }

  const normalized = value.trim().toLowerCase()
  return normalized === TEAM_ROLE_CAPTAIN
}

export const isLiaisonRole = (value) => {
  if (typeof value !== 'string') {
    return false
  }

  return value.trim().toLowerCase() === TEAM_ROLE_LIAISON
}

export const normalizeTeamRoleForWrite = (value) =>
  isCaptainRole(value)
    ? TEAM_ROLE_CAPTAIN
    : isLiaisonRole(value)
      ? TEAM_ROLE_LIAISON
      : TEAM_ROLE_PARTICIPANT

export const getCaptainRoleQuery = () => ({
  $in: [TEAM_ROLE_CAPTAIN],
})

export const getLiaisonRoleQuery = () => TEAM_ROLE_LIAISON
