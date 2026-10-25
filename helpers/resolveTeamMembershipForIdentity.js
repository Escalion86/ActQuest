const isCaptainRole = (value) => {
  if (typeof value !== 'string') {
    return false
  }

  const normalized = value.trim().toLowerCase()
  return normalized === 'captain'
}

const normalizeStringId = (value) => {
  if (value === null || value === undefined) {
    return ''
  }

  return String(value).trim()
}

const resolveTeamMembershipForIdentity = ({
  teamUsers,
  userId,
}) => {
  const memberships = Array.isArray(teamUsers) ? teamUsers : []
  const normalizedUserId = normalizeStringId(userId)

  const matchedByUserId = normalizedUserId
    ? memberships.filter(
        (teamUser) =>
          teamUser &&
          normalizeStringId(teamUser.userId) === normalizedUserId,
      )
    : []

  const matchedMemberships = matchedByUserId

  return {
    isTeamMember: matchedMemberships.length > 0,
    isCaptain: matchedMemberships.some((teamUser) =>
      isCaptainRole(teamUser?.role),
    ),
    matchedBy:
      matchedByUserId.length > 0
        ? 'userId'
        : null,
    matchedMemberships,
  }
}

module.exports = resolveTeamMembershipForIdentity
