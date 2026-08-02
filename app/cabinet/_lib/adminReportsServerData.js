import CABINET_ROLE_LABELS from '@helpers/cabinetRoleLabels'
import { ensureDateISOString, toStringId } from '@helpers/idAndDate'
import dbConnectGlobal from '@utils/dbConnectGlobal'

const createEmptyReports = () => ({
  summary: {
    totalUsers: 0,
    newUsersWeek: 0,
    activeUsersMonth: 0,
    totalTeams: 0,
    openTeams: 0,
    closedTeams: 0,
    memberships: 0,
    uniqueParticipants: 0,
    totalGames: 0,
    activeGames: 0,
    finishedGames: 0,
    canceledGames: 0,
    gamesLast30: 0,
  },
  roles: [],
  topTeams: [],
  recentActivity: [],
})

export const loadCabinetAppAdminReports = async ({ location }) => {
  const initialReports = createEmptyReports()
  if (!location) {
    return initialReports
  }

  const db = await dbConnectGlobal()
  if (!db) {
    return initialReports
  }

  const UsersModel = db.model('Users')
  const TeamsModel = db.model('Teams')
  const TeamsUsersModel = db.model('TeamsUsers')
  const GamesModel = db.model('Games')
  const GamesTeamsModel = db.model('GamesTeams')

  const [usersDocs, teamsDocs, gamesDocs, allTeamUsersDocs, allGamesTeamsDocs] =
    await Promise.all([
      UsersModel.find({}).lean(),
      TeamsModel.find({ kind: { $ne: 'personal' } }).lean(),
      GamesModel.find({}).lean(),
      TeamsUsersModel.find({}).lean(),
      GamesTeamsModel.find({}).lean(),
    ])

  const regularTeamIds = new Set(
    teamsDocs.map((team) => toStringId(team?._id)).filter(Boolean),
  )
  const teamUsersDocs = allTeamUsersDocs.filter((membership) =>
    regularTeamIds.has(toStringId(membership?.teamId)),
  )
  const gamesTeamsDocs = allGamesTeamsDocs.filter((registration) =>
    regularTeamIds.has(toStringId(registration?.teamId)),
  )

  const now = Date.now()
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000
  const monthAgo = now - 30 * 24 * 60 * 60 * 1000

  const openTeamsCount = teamsDocs.filter((team) => Boolean(team?.open)).length

  const summary = {
    totalUsers: usersDocs.length,
    newUsersWeek: usersDocs.filter((user) => {
      const createdAt = ensureDateISOString(user?.createdAt)
      return createdAt ? new Date(createdAt).getTime() >= weekAgo : false
    }).length,
    activeUsersMonth: usersDocs.filter((user) => {
      const updatedAt = ensureDateISOString(user?.updatedAt || user?.createdAt)
      return updatedAt ? new Date(updatedAt).getTime() >= monthAgo : false
    }).length,
    totalTeams: teamsDocs.length,
    openTeams: openTeamsCount,
    closedTeams: teamsDocs.length - openTeamsCount,
    memberships: teamUsersDocs.length,
    uniqueParticipants: Array.from(
      new Set(
        teamUsersDocs
          .map((doc) =>
            Number.isFinite(doc?.userTelegramId) ? doc.userTelegramId : null,
          )
          .filter((id) => id !== null),
      ),
    ).length,
    totalGames: gamesDocs.length,
    activeGames: gamesDocs.filter((game) => {
      const status =
        typeof game?.status === 'string' ? game.status.toLowerCase() : ''
      return status === 'active' || status === 'started'
    }).length,
    finishedGames: gamesDocs.filter((game) => {
      const status =
        typeof game?.status === 'string' ? game.status.toLowerCase() : ''
      return status === 'finished' || status === 'closed'
    }).length,
    canceledGames: gamesDocs.filter((game) => {
      const status =
        typeof game?.status === 'string' ? game.status.toLowerCase() : ''
      return status === 'canceled'
    }).length,
    gamesLast30: gamesDocs.filter((game) => {
      const timestamp = ensureDateISOString(game?.updatedAt || game?.createdAt)
      return timestamp ? new Date(timestamp).getTime() >= monthAgo : false
    }).length,
  }

  const rolesMap = usersDocs.reduce((acc, user) => {
    const role = typeof user?.role === 'string' ? user.role : 'client'
    acc[role] = (acc[role] || 0) + 1
    return acc
  }, {})

  const roles = Object.entries(rolesMap)
    .map(([role, count]) => ({
      role,
      label: CABINET_ROLE_LABELS[role] ?? role,
      count,
    }))
    .sort((a, b) => b.count - a.count)

  const membershipCountsByTeam = teamUsersDocs.reduce((acc, doc) => {
    const teamId = toStringId(doc?.teamId)
    if (!teamId) {
      return acc
    }
    acc[teamId] = (acc[teamId] || 0) + 1
    return acc
  }, {})

  const gamesCountByTeamSet = gamesTeamsDocs.reduce((acc, doc) => {
    const teamId = toStringId(doc?.teamId)
    const gameId = toStringId(doc?.gameId)
    if (!teamId || !gameId) {
      return acc
    }
    if (!acc[teamId]) {
      acc[teamId] = new Set()
    }
    acc[teamId].add(gameId)
    return acc
  }, {})

  const gamesCountByTeam = Object.entries(gamesCountByTeamSet).reduce(
    (acc, [teamId, ids]) => {
      acc[teamId] = ids.size
      return acc
    },
    {},
  )

  const topTeams = teamsDocs
    .map((team) => {
      const id = toStringId(team?._id)
      if (!id) {
        return null
      }

      return {
        id,
        name:
          typeof team?.name === 'string' && team.name.trim().length > 0
            ? team.name
            : 'Без названия',
        membersCount: membershipCountsByTeam[id] ?? 0,
        gamesCount: gamesCountByTeam[id] ?? 0,
        updatedAt: ensureDateISOString(team?.updatedAt),
      }
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (b.membersCount === a.membersCount) {
        return b.gamesCount - a.gamesCount
      }
      return b.membersCount - a.membersCount
    })
    .slice(0, 6)

  const recentActivityCandidates = []

  usersDocs.forEach((user) => {
    const updatedAt = ensureDateISOString(user?.updatedAt || user?.createdAt)
    if (!updatedAt) {
      return
    }
    recentActivityCandidates.push({
      id: `user-${toStringId(user?._id) ?? user?.telegramId ?? Math.random()}`,
      type: 'user',
      name: user?.name?.trim()?.length
        ? user.name
        : user?.username
          ? `@${user.username}`
          : `ID ${user?.telegramId}`,
      description: `Роль: ${CABINET_ROLE_LABELS[user?.role] ?? user?.role ?? 'Пользователь'}`,
      updatedAt,
    })
  })

  teamsDocs.forEach((team) => {
    const updatedAt = ensureDateISOString(team?.updatedAt || team?.createdAt)
    if (!updatedAt) {
      return
    }

    const id = toStringId(team?._id)
    const membersCount = membershipCountsByTeam[id] ?? 0
    const gamesCount = gamesCountByTeam[id] ?? 0

    recentActivityCandidates.push({
      id: `team-${id}`,
      type: 'team',
      name:
        typeof team?.name === 'string' && team.name.trim().length > 0
          ? team.name
          : 'Без названия',
      description: `Участников: ${membersCount} · Игр: ${gamesCount}`,
      updatedAt,
    })
  })

  gamesDocs.forEach((game) => {
    const updatedAt = ensureDateISOString(game?.updatedAt || game?.createdAt)
    if (!updatedAt) {
      return
    }

    const id = toStringId(game?._id)
    const status =
      typeof game?.status === 'string' ? game.status.toLowerCase() : ''
    const statusLabel =
      status === 'active'
        ? 'Активна'
        : status === 'started'
          ? 'Запущена'
          : status === 'finished' || status === 'closed'
            ? 'Завершена'
            : status === 'canceled'
              ? 'Отменена'
              : 'Без статуса'

    recentActivityCandidates.push({
      id: `game-${id}`,
      type: 'game',
      name:
        typeof game?.name === 'string' && game.name.trim().length > 0
          ? game.name
          : 'Без названия',
      description: `Статус: ${statusLabel}`,
      updatedAt,
    })
  })

  const recentActivity = recentActivityCandidates
    .filter((item) => item.updatedAt)
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )
    .slice(0, 12)

  initialReports.summary = summary
  initialReports.roles = roles
  initialReports.topTeams = topTeams
  initialReports.recentActivity = recentActivity

  return initialReports
}
