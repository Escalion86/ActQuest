import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
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

export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user || !isUserAdmin({ role: session.user.role })) {
    return NextResponse.json(
      { success: false, error: 'Недостаточно прав' },
      { status: 403 },
    )
  }

  try {
    const db = await dbConnectGlobal()
    if (!db) {
      throw new Error('Не удалось подключиться к базе данных')
    }

    const requestUrl = new URL(request.url)
    const offset = parsePositiveInteger(requestUrl.searchParams.get('offset'), 0)
    const limit = parsePositiveInteger(requestUrl.searchParams.get('limit'), 10)
    const search =
      typeof requestUrl.searchParams.get('q') === 'string'
        ? requestUrl.searchParams.get('q')
        : ''
    const roleFilter =
      typeof requestUrl.searchParams.get('role') === 'string'
        ? requestUrl.searchParams.get('role')
        : 'all'
    const sortBy =
      typeof requestUrl.searchParams.get('sortBy') === 'string'
        ? requestUrl.searchParams.get('sortBy')
        : 'registration_desc'
    const locationFilter =
      typeof requestUrl.searchParams.get('location') === 'string'
        ? requestUrl.searchParams.get('location')
        : 'all'
    const location =
      typeof session?.user?.location === 'string' ? session.user.location : null

    const { users, hasMore } = await fetchAdminUsersForCabinet({
      db,
      offset,
      limit,
      search,
      roleFilter,
      sortBy,
      location,
      locationFilter,
    })

    return NextResponse.json(
      {
        success: true,
        data: users,
        meta: {
          offset,
          limit,
          hasMore,
        },
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('Failed to load admin users page (app)', error)
    return NextResponse.json(
      { success: false, error: 'Не удалось загрузить список пользователей' },
      { status: 500 },
    )
  }
}
