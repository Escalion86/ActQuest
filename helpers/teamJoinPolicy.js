export const TEAM_JOIN_POLICY_OPEN = 'open'
export const TEAM_JOIN_POLICY_REQUEST = 'request'
export const TEAM_JOIN_POLICY_CLOSED = 'closed'

export const TEAM_JOIN_POLICY_VALUES = [
  TEAM_JOIN_POLICY_OPEN,
  TEAM_JOIN_POLICY_REQUEST,
  TEAM_JOIN_POLICY_CLOSED,
]

const TEAM_JOIN_POLICY_SET = new Set(TEAM_JOIN_POLICY_VALUES)

export const normalizeTeamJoinPolicy = (value) => {
  const normalized =
    typeof value === 'string' ? value.trim().toLowerCase() : ''

  return TEAM_JOIN_POLICY_SET.has(normalized)
    ? normalized
    : TEAM_JOIN_POLICY_OPEN
}

export const teamAcceptsJoinRequests = (value) =>
  normalizeTeamJoinPolicy(value) === TEAM_JOIN_POLICY_REQUEST

export const teamCanBeJoinedById = (value) =>
  normalizeTeamJoinPolicy(value) !== TEAM_JOIN_POLICY_CLOSED

export const getTeamJoinPolicyLabel = (value) => {
  const policy = normalizeTeamJoinPolicy(value)

  if (policy === TEAM_JOIN_POLICY_REQUEST) return 'По заявке'
  if (policy === TEAM_JOIN_POLICY_CLOSED) return 'Закрытая'
  return 'Открытая'
}
