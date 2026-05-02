import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import isUserAdmin from '@helpers/isUserAdmin'
import { loadCabinetAppAdminGameOrders } from '@app/cabinet/_lib/adminGameOrdersServerData'

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
    const requestUrl = new URL(request.url)
    const offset = parsePositiveInteger(requestUrl.searchParams.get('offset'), 0)
    const limit = parsePositiveInteger(requestUrl.searchParams.get('limit'), 20)
    const data = await loadCabinetAppAdminGameOrders({
      offset,
      limit,
      status: requestUrl.searchParams.get('status') || 'all',
      location: requestUrl.searchParams.get('location') || 'all',
    })

    return NextResponse.json(
      {
        success: true,
        data: data.orders,
        meta: { offset, limit, hasMore: data.hasMore },
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('Failed to load game orders list (app)', error)
    return NextResponse.json(
      { success: false, error: 'Не удалось загрузить заявки' },
      { status: 500 },
    )
  }
}
