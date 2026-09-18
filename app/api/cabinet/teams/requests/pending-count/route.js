import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import dbConnectGlobal from '@utils/dbConnectGlobal'
import { toStringId } from '@helpers/idAndDate'
import { getCaptainRoleQuery } from '@helpers/teamRoles'

const resolveUserId = (session) =>
  toStringId(
    session?.user?.globalUserId ??
      session?.user?.userId ??
      session?.user?._id ??
      session?.user?.id,
  )

export async function GET() {
  const session = await getServerSession(authOptions)
  const userId = resolveUserId(session)

  if (!session?.user || !userId) {
    return NextResponse.json(
      { success: false, error: 'Необходима авторизация' },
      { status: 401 },
    )
  }

  try {
    const db = await dbConnectGlobal()
    if (!db) {
      throw new Error('Соединение с базой данных не установлено')
    }

    const captainMemberships = await db
      .model('TeamsUsers')
      .find({ userId, role: getCaptainRoleQuery() })
      .select({ teamId: 1 })
      .lean()
    const teamIds = Array.from(
      new Set(
        captainMemberships
          .map((membership) => toStringId(membership?.teamId))
          .filter(Boolean),
      ),
    )

    if (teamIds.length === 0) {
      return NextResponse.json(
        { success: true, data: { count: 0, byTeam: {} } },
        { status: 200 },
      )
    }

    const groupedCounts = await db.model('TeamJoinRequests').aggregate([
      { $match: { teamId: { $in: teamIds }, status: 'pending' } },
      { $group: { _id: '$teamId', count: { $sum: 1 } } },
    ])
    const byTeam = groupedCounts.reduce((result, item) => {
      const teamId = toStringId(item?._id)
      const count = Number(item?.count)
      if (teamId && Number.isFinite(count) && count > 0) {
        result[teamId] = count
      }
      return result
    }, {})
    const count = Object.values(byTeam).reduce(
      (total, value) => total + value,
      0,
    )

    return NextResponse.json(
      { success: true, data: { count, byTeam } },
      { status: 200 },
    )
  } catch (error) {
    console.error('Failed to count pending team join requests', error)
    return NextResponse.json(
      { success: false, error: 'Не удалось загрузить количество заявок' },
      { status: 500 },
    )
  }
}
