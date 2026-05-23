const LEGACY_CAPTAIN_ROLE = ['cap', 'itan'].join('')

const normalizeId = (value) => {
  if (value === null || value === undefined) {
    return ''
  }

  return String(value).trim()
}

const parseDateValue = (value) => {
  if (!value) {
    return Number.POSITIVE_INFINITY
  }

  const timestamp = new Date(value).getTime()
  return Number.isFinite(timestamp) ? timestamp : Number.POSITIVE_INFINITY
}

const normalizeCaptainRole = (role) => {
  const normalized = typeof role === 'string' ? role.trim().toLowerCase() : ''
  if (normalized === 'captain' || normalized === LEGACY_CAPTAIN_ROLE) {
    return 'captain'
  }

  return normalized || 'participant'
}

const sortMemberships = (items) =>
  [...items].sort((left, right) => {
    const leftTimestamp = parseDateValue(left?.createdAt)
    const rightTimestamp = parseDateValue(right?.createdAt)

    if (leftTimestamp !== rightTimestamp) {
      return leftTimestamp < rightTimestamp ? -1 : 1
    }

    return normalizeId(left?._id).localeCompare(normalizeId(right?._id))
  })

const planTeamCaptainRepair = ({ teamId, memberships }) => {
  const normalizedTeamId = normalizeId(teamId)
  const teamMemberships = Array.isArray(memberships)
    ? memberships.filter((item) => normalizeId(item?.teamId) === normalizedTeamId)
    : []

  const normalizedMemberships = teamMemberships.map((membership) => ({
    ...membership,
    _id: normalizeId(membership?._id),
    normalizedRole: normalizeCaptainRole(membership?.role),
  }))

  const legacyMembershipIds = normalizedMemberships
    .filter((membership) => {
      const role = typeof membership?.role === 'string' ? membership.role.trim().toLowerCase() : ''
      return role === LEGACY_CAPTAIN_ROLE
    })
    .map((membership) => membership._id)

  const captains = normalizedMemberships.filter(
    (membership) => membership.normalizedRole === 'captain',
  )
  const sortedMemberships = sortMemberships(normalizedMemberships)
  const sortedCaptains = sortMemberships(captains)

  if (captains.length === 0) {
    return {
      teamId: normalizedTeamId,
      issueCode: sortedMemberships.length > 0 ? 'no_captain' : 'empty_team',
      keepCaptainMembershipId: null,
      promoteMembershipId: sortedMemberships[0]?._id || null,
      demoteMembershipIds: [],
      normalizeMembershipIds: legacyMembershipIds,
    }
  }

  if (captains.length > 1) {
    const keepCaptainMembershipId = sortedCaptains[0]?._id || null

    return {
      teamId: normalizedTeamId,
      issueCode: 'multiple_captains',
      keepCaptainMembershipId,
      promoteMembershipId: null,
      demoteMembershipIds: sortedCaptains
        .slice(1)
        .map((membership) => membership._id),
      normalizeMembershipIds: legacyMembershipIds,
    }
  }

  if (legacyMembershipIds.length > 0) {
    return {
      teamId: normalizedTeamId,
      issueCode: 'legacy_captain_role',
      keepCaptainMembershipId: sortedCaptains[0]?._id || null,
      promoteMembershipId: null,
      demoteMembershipIds: [],
      normalizeMembershipIds: legacyMembershipIds,
    }
  }

  return {
    teamId: normalizedTeamId,
    issueCode: null,
    keepCaptainMembershipId: sortedCaptains[0]?._id || null,
    promoteMembershipId: null,
    demoteMembershipIds: [],
    normalizeMembershipIds: [],
  }
}

module.exports = planTeamCaptainRepair
