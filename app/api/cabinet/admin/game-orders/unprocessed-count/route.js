import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import isUserAdmin from '@helpers/isUserAdmin'
import { countUnprocessedGameOrders } from '@app/cabinet/_lib/adminGameOrdersServerData'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user || !isUserAdmin({ role: session.user.role })) {
    return NextResponse.json(
      { success: false, error: 'Недостаточно прав' },
      { status: 403 },
    )
  }

  try {
    const count = await countUnprocessedGameOrders()

    return NextResponse.json(
      { success: true, data: { count } },
      { status: 200 },
    )
  } catch (error) {
    console.error('Failed to count unprocessed game orders', error)
    return NextResponse.json(
      { success: false, error: 'Не удалось загрузить количество заявок' },
      { status: 500 },
    )
  }
}
