const analyzeTeamCaptainIntegrity = require('./analyzeTeamCaptainIntegrity')
const planTeamCaptainRepair = require('./planTeamCaptainRepair')

const normalizeId = (value) => {
  if (value === null || value === undefined) {
    return ''
  }

  return String(value).trim()
}

const buildTeamCaptainRepairReport = ({
  teams,
  memberships,
  users,
  limit,
}) => {
  const teamItems = Array.isArray(teams) ? teams : []
  const membershipItems = Array.isArray(memberships) ? memberships : []
  const userItems = Array.isArray(users) ? users : []
  const normalizedLimit =
    Number.isFinite(Number(limit)) && Number(limit) > 0
      ? Math.trunc(Number(limit))
      : 200

  const auditReport = analyzeTeamCaptainIntegrity({
    teams: teamItems,
    memberships: membershipItems,
    users: userItems,
  })
  const teamsById = new Map(
    teamItems.map((team) => [normalizeId(team?._id), team]).filter(([id]) => id),
  )
  const usersById = new Map(
    userItems.map((user) => [normalizeId(user?._id), user]).filter(([id]) => id),
  )
  const membershipsById = new Map(
    membershipItems
      .map((membership) => [normalizeId(membership?._id), membership])
      .filter(([id]) => id),
  )

  const plans = auditReport.teamsWithIssues
    .map((issueTeam) => {
      const teamId = normalizeId(issueTeam.teamId)
      const teamMemberships = membershipItems.filter(
        (membership) => normalizeId(membership?.teamId) === teamId,
      )
      const plan = planTeamCaptainRepair({
        teamId,
        memberships: teamMemberships,
      })
      const team = teamsById.get(teamId) || null

      const attachMember = (membershipId) => {
        const membership = membershipsById.get(normalizeId(membershipId)) || null
        const user = membership?.userId
          ? usersById.get(normalizeId(membership.userId)) || null
          : null

        return membership
          ? {
              membershipId: normalizeId(membership._id),
              userId: membership?.userId ? String(membership.userId).trim() : null,
              userTelegramId:
                membership?.userTelegramId === null ||
                membership?.userTelegramId === undefined
                  ? null
                  : Number.isFinite(Number(membership.userTelegramId))
                    ? Number(membership.userTelegramId)
                    : String(membership.userTelegramId),
              userName:
                typeof user?.name === 'string' && user.name.trim()
                  ? user.name
                  : null,
              username:
                typeof user?.username === 'string' && user.username.trim()
                  ? user.username
                  : null,
              role: typeof membership?.role === 'string' ? membership.role : 'participant',
              createdAt: membership?.createdAt
                ? new Date(membership.createdAt).toISOString()
                : null,
            }
          : null
      }

      return {
        ...plan,
        teamId,
        teamName:
          typeof team?.name === 'string' && team.name.trim() ? team.name : null,
        location:
          typeof team?.location === 'string' && team.location.trim()
            ? team.location
            : null,
        membershipsCount: teamMemberships.length,
        captainCount: issueTeam.captainCount ?? 0,
        promoteMember: attachMember(plan.promoteMembershipId),
        keepCaptainMember: attachMember(plan.keepCaptainMembershipId),
        demoteMembers: plan.demoteMembershipIds
          .map((membershipId) => attachMember(membershipId))
          .filter(Boolean),
        normalizeMembers: plan.normalizeMembershipIds
          .map((membershipId) => attachMember(membershipId))
          .filter(Boolean),
      }
    })
    .filter((plan) => plan.issueCode && plan.issueCode !== 'empty_team')

  const limitedPlans =
    plans.length > normalizedLimit ? plans.slice(0, normalizedLimit) : plans

  return {
    summary: {
      teamsCheckedCount: auditReport.summary.teamsCheckedCount,
      teamsToRepairCount: plans.length,
      noCaptainTeamsCount: plans.filter((plan) => plan.issueCode === 'no_captain')
        .length,
      multipleCaptainsTeamsCount: plans.filter(
        (plan) => plan.issueCode === 'multiple_captains',
      ).length,
      legacyCaptainRoleTeamsCount: plans.filter(
        (plan) => plan.issueCode === 'legacy_captain_role',
      ).length,
      limitApplied: normalizedLimit,
      plansReturnedCount: limitedPlans.length,
      truncated: limitedPlans.length < plans.length,
    },
    plans: limitedPlans,
  }
}

module.exports = buildTeamCaptainRepairReport
