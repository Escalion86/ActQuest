export const TEAM_ROLE_CAPTAIN = 'captain'
export const TEAM_ROLE_CAPITAN_LEGACY = 'capitan'
export const TEAM_ROLE_PARTICIPANT = 'participant'

export const isCaptainRole = (value) => {
  if (typeof value !== 'string') {
    return false
  }

  const normalized = value.trim().toLowerCase()
  return (
    normalized === TEAM_ROLE_CAPTAIN ||
    normalized === TEAM_ROLE_CAPITAN_LEGACY
  )
}

export const normalizeTeamRoleForWrite = (value) =>
  isCaptainRole(value) ? TEAM_ROLE_CAPTAIN : TEAM_ROLE_PARTICIPANT

export const getCaptainRoleQuery = () => ({
  $in: [TEAM_ROLE_CAPTAIN, TEAM_ROLE_CAPITAN_LEGACY],
})
