import dbConnectGlobal from '@utils/dbConnectGlobal'
import fetchTeamsForCabinet from '@helpers/fetchTeamsForCabinet'

const normalizeLocation = (value) => {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim().toLowerCase()
  return normalized || null
}

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

const toFiniteNumberOrNull = (value) => {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

export const loadCabinetAppTeams = async (session) => {
  const db = await dbConnectGlobal()
  if (!db) {
    return []
  }

  const location = normalizeLocation(session?.user?.location)
  if (!location) {
    return []
  }

  const userId = toStringOrNull(session?.user?._id)
  const telegramId = toFiniteNumberOrNull(session?.user?.telegramId)

  if (!userId && telegramId === null) {
    return []
  }

  const TeamsUsersModel = db.model('TeamsUsers')

  const membershipQuery = userId
    ? telegramId !== null
      ? {
          $or: [{ userId }, { userTelegramId: telegramId }],
        }
      : { userId }
    : { userTelegramId: telegramId }

  const memberships = await TeamsUsersModel.find(membershipQuery)
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

  const teams = await fetchTeamsForCabinet({ db, teamIds, location })
  return Array.isArray(teams) ? teams : []
}

