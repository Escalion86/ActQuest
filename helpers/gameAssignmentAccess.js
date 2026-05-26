const normalizeStringId = (value) => {
  if (value === null || value === undefined) {
    return ''
  }

  if (typeof value === 'string') {
    return value.trim()
  }

  if (typeof value?.toString === 'function') {
    const nextValue = value.toString()
    return nextValue === '[object Object]' ? '' : nextValue.trim()
  }

  return ''
}

const normalizeSystemRole = (value) => {
  if (typeof value !== 'string') {
    return 'client'
  }

  const normalized = value.trim().toLowerCase()
  return ['client', 'admin', 'dev', 'ban'].includes(normalized)
    ? normalized
    : 'client'
}

const canBypassGameAssignments = (role) => {
  const normalizedRole = normalizeSystemRole(role)
  return normalizedRole === 'admin' || normalizedRole === 'dev'
}

const resolveGameModeratorIds = (game) =>
  (Array.isArray(game?.moderators) ? game.moderators : [])
    .map((moderator) => normalizeStringId(moderator?._id ?? moderator?.id ?? moderator))
    .filter(Boolean)

const resolveGameAgentIds = (game) =>
  (Array.isArray(game?.agents) ? game.agents : [])
    .map((agent) => ({
      userId: normalizeStringId(agent?.userId ?? agent?.id ?? agent),
      active: agent?.active !== false,
    }))
    .filter((agent) => agent.userId && agent.active)
    .map((agent) => agent.userId)

const canAccessGameAsModerator = ({ userRole, currentUserId, game }) => {
  if (canBypassGameAssignments(userRole)) {
    return true
  }

  const normalizedUserId = normalizeStringId(currentUserId)
  if (!normalizedUserId) {
    return false
  }

  return resolveGameModeratorIds(game).includes(normalizedUserId)
}

const canAccessGameAsAgent = ({ userRole, currentUserId, game }) => {
  if (canBypassGameAssignments(userRole)) {
    return true
  }

  const normalizedUserId = normalizeStringId(currentUserId)
  if (!normalizedUserId) {
    return false
  }

  return resolveGameAgentIds(game).includes(normalizedUserId)
}

const canViewAgentCabinet = () => true

export {
  canAccessGameAsAgent,
  canAccessGameAsModerator,
  canBypassGameAssignments,
  canViewAgentCabinet,
  normalizeStringId,
  normalizeSystemRole,
  resolveGameAgentIds,
  resolveGameModeratorIds,
}
