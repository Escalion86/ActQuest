import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import canManageTransactions from '@helpers/canManageTransactions'
import dbConnectGlobal from '@utils/dbConnectGlobal'
import { issueCoupon } from '@server/transactionsService'

export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user || !canManageTransactions({ role: session.user.role })) {
    return NextResponse.json(
      { success: false, error: 'Недостаточно прав' },
      { status: 403 },
    )
  }

  try {
    const db = await dbConnectGlobal()
    if (!db) {
      return NextResponse.json(
        { success: false, error: 'Не удалось подключиться к базе данных' },
        { status: 500 },
      )
    }

    const body = await request.json().catch(() => ({}))
    const payload = body?.data ?? body ?? {}
    const created = await issueCoupon({
      db,
      data: {
        ...payload,
        location: payload.location || session?.user?.location || null,
      },
    })

    return NextResponse.json({ success: true, data: created }, { status: 201 })
  } catch (error) {
    console.error('Issue coupon API error (app)', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Не удалось выдать купон' },
      { status: 400 },
    )
  }
}
