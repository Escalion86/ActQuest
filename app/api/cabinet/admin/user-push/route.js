import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import isUserAdmin from '@helpers/isUserAdmin'
import dbConnectGlobal from '@utils/dbConnectGlobal'
import { broadcastNotificationToUsers } from '@server/pwaNotifications'
import resolveUserCityKey from '@helpers/resolveUserCityKey'

const sanitizeText = (value) => (typeof value === 'string' ? value.trim() : '')

export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user || !isUserAdmin({ role: session.user.role })) {
    return NextResponse.json(
      { success: false, error: 'Недостаточно прав' },
      { status: 403 },
    )
  }

  const body = await request.json().catch(() => ({}))
  const userId = sanitizeText(body?.userId)
  const message = sanitizeText(body?.message)

  if (!userId) {
    return NextResponse.json(
      {
        success: false,
        error: 'Не указан пользователь для отправки уведомления',
      },
      { status: 400 },
    )
  }

  if (!message) {
    return NextResponse.json(
      {
        success: false,
        error: 'Введите сообщение для отправки',
      },
      { status: 400 },
    )
  }

  if (message.length > 1200) {
    return NextResponse.json(
      {
        success: false,
        error: 'Сообщение слишком длинное. Максимум 1200 символов.',
      },
      { status: 400 },
    )
  }

  try {
    const db = await dbConnectGlobal()
    if (!db) {
      return NextResponse.json(
        {
          success: false,
          error: 'База пользователей недоступна',
        },
        { status: 503 },
      )
    }

    const user = await db
      .model('Users')
      .findById(userId)
      .select({
        _id: 1,
        telegramId: 1,
        name: 1,
        accountLocation: 1,
        currentLocation: 1,
        pushSubscriptions: 1,
      })
      .lean()

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Пользователь не найден',
        },
        { status: 404 },
      )
    }

    const userTelegramId = Number(user?.telegramId)
    if (!Number.isFinite(userTelegramId)) {
      return NextResponse.json(
        {
          success: false,
          error: 'У пользователя не указан Telegram ID для отправки уведомлений',
        },
        { status: 400 },
      )
    }

    const location =
      resolveUserCityKey(
        {
          currentLocation: user?.currentLocation,
          accountLocation: user?.accountLocation,
          location: session?.user?.location,
        },
        null,
      ) || 'global'

    const notification = {
      title: 'Сообщение администратора',
      body: message,
      tag: `admin-user-push-${userId}`,
      location,
      data: {
        type: 'admin_user_push',
        userId,
        userName: sanitizeText(user?.name) || 'Пользователь',
        location,
        url: '/cabinet?tab=notifications',
      },
    }

    const result = await broadcastNotificationToUsers({
      db,
      users: [user],
      notification,
    })

    return NextResponse.json(
      {
        success: true,
        data: {
          created: Number(result?.created || 0),
          delivered: Number(result?.delivered || 0),
          removed: Number(result?.removed || 0),
        },
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('Failed to send admin push to user (app)', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Не удалось отправить push-уведомление пользователю',
      },
      { status: 500 },
    )
  }
}
