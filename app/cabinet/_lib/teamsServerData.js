import dbConnectGlobal from '@utils/dbConnectGlobal'
import fetchTeamsForCabinet from '@helpers/fetchTeamsForCabinet'

const toStringOrNull = (value) => {
  if (value === null || value === undefined) {
    return null
  }

  if (typeof value === 'string') {
    const normalized = value.trim()
    return normalized || null
  }

  return String(value)
}

export const loadCabinetAppTeams = async (session) => {
  const db = await dbConnectGlobal()
  if (!db) {
    return []
  }

  const userId = toStringOrNull(session?.user?._id)
  if (!userId) {
    return []
  }

  const TeamsUsersModel = db.model('TeamsUsers')
  const memberships = await TeamsUsersModel.find({ userId })
    .select({ teamId: 1 })
    .lean()

  const teamIds = Array.from(
    new Set(
      (Array.isArray(memberships) ? memberships : [])
        .map((membership) =>
          membership?.teamId ? String(membership.teamId) : null,
        )
        .filter(Boolean),
    ),
  )

  if (teamIds.length === 0) {
    return []
  }

  const teams = await fetchTeamsForCabinet({
    db,
    teamIds,
    // Для страницы "Мои команды" показываем все команды пользователя,
    // независимо от города команды.
    location: null,
  })
  return Array.isArray(teams) ? teams : []
}
