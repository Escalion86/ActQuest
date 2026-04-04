import dbConnectGlobal from '@utils/dbConnectGlobal'
import fetchAdminUsersForCabinet from '@helpers/fetchAdminUsersForCabinet'

export const loadCabinetAppAdminUsers = async ({
  session,
  offset = 0,
  limit = 10,
}) => {
  const db = await dbConnectGlobal()
  if (!db) {
    return { users: [], hasMore: false }
  }

  const location =
    typeof session?.user?.location === 'string' ? session.user.location : null

  const { users, hasMore } = await fetchAdminUsersForCabinet({
    db,
    offset,
    limit,
    search: '',
    roleFilter: 'all',
    sortBy: 'registration_desc',
    location,
  })

  return {
    users: Array.isArray(users) ? users : [],
    hasMore: Boolean(hasMore),
  }
}
