import { isCaptainRole } from '../helpers/teamRoles.js'

const normalizeText = (value) =>
  typeof value === 'string' ? value.trim() : ''

const toId = (value) => {
  if (!value) {
    return ''
  }

  if (typeof value === 'string') {
    return value.trim()
  }

  if (typeof value === 'object' && typeof value.toString === 'function') {
    return value.toString().trim()
  }

  return ''
}

const sortMembershipsForCaptaincy = (memberships) =>
  [...memberships].sort((first, second) => {
    const firstCreated = first?.createdAt ? new Date(first.createdAt).getTime() : Number.NaN
    const secondCreated = second?.createdAt ? new Date(second.createdAt).getTime() : Number.NaN

    if (Number.isFinite(firstCreated) && Number.isFinite(secondCreated)) {
      if (firstCreated !== secondCreated) {
        return firstCreated - secondCreated
      }
    } else if (Number.isFinite(firstCreated)) {
      return -1
    } else if (Number.isFinite(secondCreated)) {
      return 1
    }

    return toId(first?._id).localeCompare(toId(second?._id), 'ru')
  })

const buildTeamAction = ({
  membership,
  team,
  otherMemberships,
  usersById,
}) => {
  const teamId = toId(team?._id || membership?.teamId)
  const teamName = normalizeText(team?.name) || teamId
  const isCaptain = isCaptainRole(membership?.role)

  if (!isCaptain) {
    return {
      teamId,
      teamName,
      membershipId: toId(membership?._id),
      currentRole: normalizeText(membership?.role) || 'participant',
      action: 'remove_member',
      nextCaptain: null,
    }
  }

  if (!otherMemberships.length) {
    return {
      teamId,
      teamName,
      membershipId: toId(membership?._id),
      currentRole: 'captain',
      action: 'delete_team',
      nextCaptain: null,
    }
  }

  const [nextCaptainMembership] = sortMembershipsForCaptaincy(otherMemberships)
  const nextCaptainUser = usersById.get(toId(nextCaptainMembership?.userId)) ?? null

  return {
    teamId,
    teamName,
    membershipId: toId(membership?._id),
    currentRole: 'captain',
    action: 'transfer_captaincy',
    nextCaptain: {
      membershipId: toId(nextCaptainMembership?._id),
      userId: toId(nextCaptainMembership?.userId),
      name: normalizeText(nextCaptainUser?.name) || null,
    },
  }
}

const loadBanContext = async ({ db, userId }) => {
  const Users = db.model('Users')
  const Teams = db.model('Teams')
  const TeamsUsers = db.model('TeamsUsers')

  const user = await Users.findById(userId).lean()
  if (!user?._id) {
    return null
  }

  const memberships = await TeamsUsers.find({ userId })
    .select({ _id: 1, teamId: 1, userId: 1, role: 1, createdAt: 1 })
    .lean()
  const teamIds = Array.from(
    new Set((Array.isArray(memberships) ? memberships : []).map((item) => toId(item?.teamId)).filter(Boolean)),
  )

  const [teams, teamMemberships] = await Promise.all([
    teamIds.length
      ? Teams.find({ _id: { $in: teamIds } }).select({ _id: 1, name: 1 }).lean()
      : [],
    teamIds.length
      ? TeamsUsers.find({ teamId: { $in: teamIds } })
          .select({ _id: 1, teamId: 1, userId: 1, role: 1, createdAt: 1 })
          .lean()
      : [],
  ])

  const otherUserIds = Array.from(
    new Set(
      (Array.isArray(teamMemberships) ? teamMemberships : [])
        .map((item) => toId(item?.userId))
        .filter((memberUserId) => memberUserId && memberUserId !== userId),
    ),
  )

  const users =
    otherUserIds.length > 0
      ? await Users.find({ _id: { $in: otherUserIds } })
          .select({ _id: 1, name: 1, role: 1 })
          .lean()
      : []

  return {
    user,
    memberships: Array.isArray(memberships) ? memberships : [],
    teams: Array.isArray(teams) ? teams : [],
    teamMemberships: Array.isArray(teamMemberships) ? teamMemberships : [],
    users: Array.isArray(users) ? users : [],
  }
}

export const buildWebUserBanPreview = async ({ db, userId }) => {
  const context = await loadBanContext({ db, userId })
  if (!context) {
    return null
  }

  const teamsById = new Map(context.teams.map((team) => [toId(team?._id), team]))
  const usersById = new Map(context.users.map((item) => [toId(item?._id), item]))
  const membershipsByTeamId = new Map()

  context.teamMemberships.forEach((membership) => {
    const teamId = toId(membership?.teamId)
    if (!teamId) {
      return
    }

    const items = membershipsByTeamId.get(teamId) ?? []
    items.push(membership)
    membershipsByTeamId.set(teamId, items)
  })

  const teams = context.memberships.map((membership) => {
    const teamId = toId(membership?.teamId)
    const allMemberships = membershipsByTeamId.get(teamId) ?? []
    const otherMemberships = allMemberships.filter(
      (item) => toId(item?.userId) !== userId,
    )

    return buildTeamAction({
      membership,
      team: teamsById.get(teamId) ?? null,
      otherMemberships,
      usersById,
    })
  })

  return {
    user: {
      id: toId(context.user?._id),
      name: normalizeText(context.user?.name) || null,
      role: normalizeText(context.user?.role) || 'client',
    },
    summary: {
      teamsCount: teams.length,
      captainTeamsCount: teams.filter((team) => team.currentRole === 'captain').length,
      deletedTeamsCount: teams.filter((team) => team.action === 'delete_team').length,
      transferTeamsCount: teams.filter((team) => team.action === 'transfer_captaincy').length,
    },
    teams,
  }
}

export const applyWebUserBan = async ({ db, userId }) => {
  const preview = await buildWebUserBanPreview({ db, userId })
  if (!preview) {
    return null
  }

  const Users = db.model('Users')
  const Teams = db.model('Teams')
  const TeamsUsers = db.model('TeamsUsers')

  const currentUser = await Users.findById(userId).lean()
  if (normalizeText(currentUser?.role) === 'ban') {
    return {
      alreadyBanned: true,
      user: {
        ...preview.user,
        role: 'ban',
      },
      summary: preview.summary,
      teams: preview.teams,
    }
  }

  for (const teamAction of preview.teams) {
    if (teamAction.action === 'delete_team') {
      await Teams.deleteOne({ _id: teamAction.teamId })
      await TeamsUsers.deleteMany({ teamId: teamAction.teamId })
      continue
    }

    if (teamAction.action === 'transfer_captaincy' && teamAction.nextCaptain?.membershipId) {
      await TeamsUsers.updateMany(
        {
          teamId: teamAction.teamId,
          role: 'captain',
          _id: { $ne: teamAction.nextCaptain.membershipId },
        },
        { $set: { role: 'participant' } },
      )
      await TeamsUsers.findByIdAndUpdate(teamAction.nextCaptain.membershipId, {
        $set: { role: 'captain' },
      })
    }

    await TeamsUsers.deleteOne({ _id: teamAction.membershipId })
  }

  await Users.findByIdAndUpdate(userId, { $set: { role: 'ban' } })
  const updatedUser = await Users.findById(userId).lean()

  return {
    alreadyBanned: false,
    user: {
      id: toId(updatedUser?._id),
      name: normalizeText(updatedUser?.name) || null,
      role: normalizeText(updatedUser?.role) || 'ban',
    },
    summary: preview.summary,
    teams: preview.teams,
  }
}
