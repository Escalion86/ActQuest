import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import dbConnectGlobal from '@utils/dbConnectGlobal'

const isDeveloperRole = (role) => {
  if (typeof role !== 'string') {
    return false
  }

  return role.trim().toLowerCase() === 'dev'
}

const hasPhone = (value) => {
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric > 0
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user || !isDeveloperRole(session.user.role)) {
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

    const users = await db
      .model('Users')
      .find({
        $or: [{ phone: null }, { phone: { $exists: false } }, { phone: 0 }],
      })
      .select({
        _id: 1,
        name: 1,
        username: 1,
        telegramId: 1,
        role: 1,
        phone: 1,
        accountLocation: 1,
        currentLocation: 1,
        createdAt: 1,
      })
      .sort({ createdAt: -1, _id: 1 })
      .lean()

    const normalized = users
      .filter((user) => !hasPhone(user?.phone))
      .map((user) => ({
        id: String(user?._id || ''),
        name: typeof user?.name === 'string' ? user.name : '',
        username: typeof user?.username === 'string' ? user.username : '',
        telegramId: Number.isFinite(Number(user?.telegramId))
          ? Number(user.telegramId)
          : null,
        role: typeof user?.role === 'string' ? user.role : 'client',
        phone: hasPhone(user?.phone) ? Number(user.phone) : null,
        accountLocation:
          typeof user?.accountLocation === 'string'
            ? user.accountLocation
            : typeof user?.currentLocation === 'string'
              ? user.currentLocation
              : null,
        createdAt: user?.createdAt
          ? new Date(user.createdAt).toISOString()
          : null,
      }))

    return NextResponse.json(
      {
        success: true,
        data: {
          usersCount: normalized.length,
          users: normalized,
        },
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('Failed to load users without phone (app)', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Не удалось загрузить список пользователей без телефона',
      },
      { status: 500 },
    )
  }
}
