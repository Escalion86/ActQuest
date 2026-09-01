import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import isUserAdmin from '@helpers/isUserAdmin'
import { countPendingGameReviews } from '@app/cabinet/_lib/adminGameReviewsServerData'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user || !isUserAdmin({ role: session.user.role })) {
    return NextResponse.json(
      { success: false, error: 'Недостаточно прав' },
      { status: 403 },
    )
  }

  try {
    const count = await countPendingGameReviews()

    return NextResponse.json(
      { success: true, data: { count } },
      { status: 200 },
    )
  } catch (error) {
    console.error('Failed to count pending game reviews', error)
    return NextResponse.json(
      { success: false, error: 'Не удалось загрузить количество отзывов' },
      { status: 500 },
    )
  }
}
