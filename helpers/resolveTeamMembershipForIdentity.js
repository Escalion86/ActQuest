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
  telegramId,
}) => {
  const memberships = Array.isArray(teamUsers) ? teamUsers : []
  const normalizedUserId = normalizeStringId(userId)
  const normalizedTelegramId = normalizeStringId(telegramId)

  const matchedByUserId = normalizedUserId
    ? memberships.filter(
        (teamUser) =>
          teamUser &&
          normalizeStringId(teamUser.userId) === normalizedUserId,
      )
    : []

  const matchedMemberships =
    matchedByUserId.length > 0
      ? matchedByUserId
      : normalizedTelegramId
        ? memberships.filter(
            (teamUser) =>
              teamUser &&
              normalizeStringId(teamUser.userTelegramId) ===
                normalizedTelegramId,
          )
        : []

  return {
    isTeamMember: matchedMemberships.length > 0,
    isCaptain: matchedMemberships.some((teamUser) =>
      isCaptainRole(teamUser?.role),
    ),
    matchedBy:
      matchedByUserId.length > 0
        ? 'userId'
        : matchedMemberships.length > 0
          ? 'telegramId'
          : null,
    matchedMemberships,
  }
}

module.exports = resolveTeamMembershipForIdentity
