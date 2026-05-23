const CAPTAIN_ROLES = new Set(['captain'])

const normalizeId = (value) => {
  if (value === null || value === undefined) {
    return ''
  }

  return String(value).trim()
}

const isCaptainRole = (value) => {
  if (typeof value !== 'string') {
    return false
  }

  return CAPTAIN_ROLES.has(value.trim().toLowerCase())
}

const analyzeTeamCaptainIntegrity = ({
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
      : null

  const teamsById = new Map(
    teamItems
      .map((team) => [normalizeId(team?._id), team])
      .filter(([teamId]) => teamId),
  )
  const usersById = new Map(
    userItems
      .map((user) => [normalizeId(user?._id), user])
      .filter(([userId]) => userId),
  )
  const membershipsByTeamId = new Map()

  membershipItems.forEach((membership) => {
    const teamId = normalizeId(membership?.teamId)
    if (!teamId) {
      return
    }

    const bucket = membershipsByTeamId.get(teamId) || []
    bucket.push(membership)
    membershipsByTeamId.set(teamId, bucket)
  })

  const teamsChecked = Array.from(membershipsByTeamId.entries()).map(
    ([teamId, teamMemberships]) => {
      const team = teamsById.get(teamId) || null
      const members = teamMemberships.map((membership) => {
        const userId = normalizeId(membership?.userId)
        const linkedUser = userId ? usersById.get(userId) || null : null

        return {
          membershipId: normalizeId(membership?._id),
          userId: userId || null,
          userTelegramId:
            membership?.userTelegramId === null ||
            membership?.userTelegramId === undefined
              ? null
              : Number.isFinite(Number(membership.userTelegramId))
                ? Number(membership.userTelegramId)
                : String(membership.userTelegramId),
          role: typeof membership?.role === 'string' ? membership.role : 'participant',
          userName:
            typeof linkedUser?.name === 'string' && linkedUser.name.trim()
              ? linkedUser.name
              : null,
          username:
            typeof linkedUser?.username === 'string' && linkedUser.username.trim()
              ? linkedUser.username
              : null,
          hasLinkedUser: Boolean(linkedUser?._id),
        }
      })

      const captains = members.filter((member) => isCaptainRole(member.role))
      const captainCount = captains.length
      const issueCode =
        captainCount === 0
          ? 'no_captain'
          : captainCount > 1
            ? 'multiple_captains'
            : null

      return {
        teamId,
        teamName:
          typeof team?.name === 'string' && team.name.trim()
            ? team.name
            : null,
        location:
          typeof team?.location === 'string' && team.location.trim()
            ? team.location
            : null,
        membershipsCount: members.length,
        captainCount,
        captains,
        members,
        issueCode,
      }
    },
  )

  const issueTeams = teamsChecked.filter((team) => Boolean(team.issueCode))
  const limitedIssueTeams =
    normalizedLimit && issueTeams.length > normalizedLimit
      ? issueTeams.slice(0, normalizedLimit)
      : issueTeams

  return {
    summary: {
      teamsCheckedCount: teamsChecked.length,
      teamsWithIssuesCount: issueTeams.length,
      noCaptainTeamsCount: issueTeams.filter((team) => team.issueCode === 'no_captain')
        .length,
      multipleCaptainsTeamsCount: issueTeams.filter(
        (team) => team.issueCode === 'multiple_captains',
      ).length,
      issueTeamsReturnedCount: limitedIssueTeams.length,
      limitApplied: normalizedLimit,
      truncated:
        Boolean(normalizedLimit) && limitedIssueTeams.length < issueTeams.length,
    },
    teamsWithIssues: limitedIssueTeams,
  }
}

module.exports = analyzeTeamCaptainIntegrity
