import dbConnectGlobal from '@utils/dbConnectGlobal'
import fetchTeamsForCabinet from '@helpers/fetchTeamsForCabinet'

export const loadCabinetAppAdminTeams = async ({
  session,
  offset = 0,
  limit = 10,
}) => {
  const db = await dbConnectGlobal()
  if (!db) {
    return { teams: [], hasMore: false }
  }

  const location =
    typeof session?.user?.location === 'string' ? session.user.location : null
  if (!location) {
    return { teams: [], hasMore: false }
  }

  const result = await fetchTeamsForCabinet({
    db,
    location,
    offset,
    limit,
    returnMeta: true,
  })

  const teams = Array.isArray(result)
    ? result
    : Array.isArray(result?.teams)
      ? result.teams
      : []
  const hasMore = Array.isArray(result)
    ? result.length === limit
    : Boolean(result?.hasMore)

  return { teams, hasMore }
}
