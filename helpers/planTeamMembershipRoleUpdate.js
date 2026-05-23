const {
  isCaptainRole,
  isLiaisonRole,
  normalizeTeamRoleForWrite,
} = require('./teamRoles')

const normalizeId = (value) => {
  if (value === null || value === undefined) {
    return ''
  }

  return String(value).trim()
}

const planTeamMembershipRoleUpdate = ({
  membershipId,
  memberships,
  nextRole,
}) => {
  const normalizedMembershipId = normalizeId(membershipId)
  const normalizedNextRole = normalizeTeamRoleForWrite(nextRole)
  const items = Array.isArray(memberships) ? memberships : []
  const targetMembership =
    items.find((item) => normalizeId(item?._id) === normalizedMembershipId) ||
    null

  if (!targetMembership) {
    return {
      ok: false,
      code: 'membership_not_found',
      nextRole: normalizedNextRole,
      targetMembership: null,
      demoteCaptainIds: [],
      demoteLiaisonIds: [],
    }
  }

  const targetIsCaptain = isCaptainRole(targetMembership.role)
  const otherCaptainIds = items
    .filter(
      (item) =>
        isCaptainRole(item?.role) && normalizeId(item?._id) !== normalizedMembershipId,
    )
    .map((item) => normalizeId(item?._id))
    .filter(Boolean)
  const otherLiaisonIds = items
    .filter(
      (item) =>
        isLiaisonRole(item?.role) && normalizeId(item?._id) !== normalizedMembershipId,
    )
    .map((item) => normalizeId(item?._id))
    .filter(Boolean)

  if (
    normalizedNextRole !== 'captain' &&
    targetIsCaptain &&
    otherCaptainIds.length === 0
  ) {
    return {
      ok: false,
      code: 'captain_required',
      nextRole: normalizedNextRole,
      targetMembership,
      demoteCaptainIds: [],
      demoteLiaisonIds: [],
    }
  }

  return {
    ok: true,
    code: null,
    nextRole: normalizedNextRole,
    targetMembership,
    demoteCaptainIds:
      normalizedNextRole === 'captain' ? otherCaptainIds : [],
    demoteLiaisonIds:
      normalizedNextRole === 'liaison' ? otherLiaisonIds : [],
  }
}

module.exports = planTeamMembershipRoleUpdate
