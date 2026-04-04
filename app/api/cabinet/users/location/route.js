import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import dbConnectGlobal from '@utils/dbConnectGlobal'
import { LOCATIONS } from '@server/serverConstants'

const resolveAllowedLocations = () =>
  Object.entries(LOCATIONS)
    .filter(([, value]) => !value.hidden)
    .map(([key]) => key)

export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: 'Необходима авторизация' },
      { status: 401 },
    )
  }

  const body = await request.json().catch(() => ({}))
  const rawLocation = body?.location
  const location = typeof rawLocation === 'string' ? rawLocation.trim() : ''
  const allowedLocations = resolveAllowedLocations()

  if (!location || !allowedLocations.includes(location)) {
    return NextResponse.json(
      {
        success: false,
        error: 'Некорректный город',
        allowedLocations,
      },
      { status: 400 },
    )
  }

  try {
    const globalDb = await dbConnectGlobal()
    if (!globalDb) {
      return NextResponse.json(
        {
          success: false,
          error: 'Глобальная база пользователей недоступна',
        },
        { status: 503 },
      )
    }

    const Users = globalDb.model('Users')
    const globalUserId = session.user.globalUserId || session.user._id || null

    const filter = globalUserId
      ? { _id: globalUserId }
      : session.user.telegramId
        ? { telegramId: Number(session.user.telegramId) }
        : session.user.vkId
          ? { vkId: Number(session.user.vkId) }
          : session.user.phone
            ? { phone: Number(session.user.phone) }
            : null

    if (!filter) {
      return NextResponse.json(
        {
          success: false,
          error: 'Не удалось определить пользователя для обновления города',
        },
        { status: 400 },
      )
    }

    const updatedUser = await Users.findOneAndUpdate(
      filter,
      { $set: { currentLocation: location } },
      { new: true },
    ).lean()

    if (!updatedUser) {
      return NextResponse.json(
        {
          success: false,
          error: 'Пользователь не найден в глобальной базе',
        },
        { status: 404 },
      )
    }

    return NextResponse.json(
      {
        success: true,
        location,
        globalUserId: updatedUser?._id ? String(updatedUser._id) : null,
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('Failed to update user location (app)', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Не удалось обновить город пользователя',
      },
      { status: 500 },
    )
  }
}
