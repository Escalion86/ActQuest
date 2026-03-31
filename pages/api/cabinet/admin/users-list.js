import { getServerSession } from 'next-auth/next'

import { authOptions } from '@pages/api/auth/[...nextauth]'
import fetchAdminUsersForCabinet from '@helpers/fetchAdminUsersForCabinet'
import isUserAdmin from '@helpers/isUserAdmin'
import dbConnectGlobal from '@utils/dbConnectGlobal'

const parsePositiveInteger = (value, fallback) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric < 0) {
    return fallback
  }
  return Math.floor(numeric)
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).json({ success: false, error: 'Метод не поддерживается' })
  }

  const session = await getServerSession(req, res, authOptions)
  if (!session?.user || !isUserAdmin({ role: session.user.role })) {
    return res.status(403).json({ success: false, error: 'Недостаточно прав' })
  }

  try {
    const db = await dbConnectGlobal()
    if (!db) {
      throw new Error('Не удалось подключиться к базе данных')
    }

    const offset = parsePositiveInteger(req.query?.offset, 0)
    const limit = parsePositiveInteger(req.query?.limit, 10)
    const search = typeof req.query?.q === 'string' ? req.query.q : ''
    const roleFilter =
      typeof req.query?.role === 'string' ? req.query.role : 'all'
    const sortBy = typeof req.query?.sortBy === 'string' ? req.query.sortBy : 'registration_desc'
    const location = typeof session?.user?.location === 'string' ? session.user.location : null
    const { users, hasMore } = await fetchAdminUsersForCabinet({
      db,
      offset,
      limit,
      search,
      roleFilter,
      sortBy,
      location,
    })

    return res.status(200).json({
      success: true,
      data: users,
      meta: {
        offset,
        limit,
        hasMore,
      },
    })
  } catch (error) {
    console.error('Failed to load admin users page', error)
    return res.status(500).json({ success: false, error: 'Не удалось загрузить список пользователей' })
  }
}
