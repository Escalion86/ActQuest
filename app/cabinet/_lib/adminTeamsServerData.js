import dbConnectGlobal from '@utils/dbConnectGlobal'
import fetchTeamsForCabinet from '@helpers/fetchTeamsForCabinet'

export const loadCabinetAppAdminTeams = async ({
  offset = 0,
  limit = 10,
}) => {
  try {
    const db = await dbConnectGlobal()
    if (!db) {
      throw new Error('Не удалось подключиться к базе данных')
    }

    const result = await fetchTeamsForCabinet({
      db,
      location: null,
      teamLocationFilter: 'all',
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
  } catch (error) {
    console.error('Failed to load initial admin teams page', error)
    return {
      teams: [],
      hasMore: false,
    }
  }
}
