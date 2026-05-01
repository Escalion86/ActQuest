import mongoose from 'mongoose'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import dbConnectGlobal from '@utils/dbConnectGlobal'
import { authOptions } from '@server/auth/authOptions'

const toIsoString = (value) => {
  if (!value) return null

  try {
    if (value instanceof Date) {
      return value.toISOString()
    }

    const date = new Date(value)
    if (Number.isNaN(date.getTime())) {
      return null
    }

    return date.toISOString()
  } catch (error) {
    return null
  }
}

const mapNotification = (notification) => ({
  id: notification._id.toString(),
  title: notification.title,
  body: notification.body,
  data: notification.data || {},
  tag: notification.tag || null,
  readAt: toIsoString(notification.readAt),
  createdAt: toIsoString(notification.createdAt),
  updatedAt: toIsoString(notification.updatedAt),
  location: notification.location,
})

const getSessionUserId = (session) => {
  const rawId =
    session?.user?.globalUserId ||
    session?.user?.userId ||
    session?.user?._id ||
    session?.user?.id ||
    null

  return rawId ? String(rawId) : ''
}

export async function GET(request) {
  const session = await getServerSession(authOptions)
  const userId = getSessionUserId(session)

  if (!userId) {
    return NextResponse.json(
      {
        success: false,
        error: 'Необходимо войти в аккаунт, чтобы просматривать уведомления.',
      },
      { status: 401 },
    )
  }

  const location =
    request.nextUrl.searchParams.get('location') || session.user.location

  if (!location) {
    return NextResponse.json(
      {
        success: false,
        error: 'Не удалось определить игровой регион для уведомлений.',
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
          error: 'Глобальная база недоступна для уведомлений.',
        },
        { status: 503 },
      )
    }

    const Notifications = db.model('Notifications')
    const limitParam = request.nextUrl.searchParams.get('limit')
    const limit = Math.min(Math.max(parseInt(limitParam || '50', 10), 1), 200)

    const notifications = await Notifications.find({
      userId,
      location,
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean()

    return NextResponse.json(
      {
        success: true,
        notifications: notifications.map(mapNotification),
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('Notifications API error', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Не удалось обработать запрос к уведомлениям.',
      },
      { status: 500 },
    )
  }
}

export async function PATCH(request) {
  const session = await getServerSession(authOptions)
  const userId = getSessionUserId(session)

  if (!userId) {
    return NextResponse.json(
      {
        success: false,
        error: 'Необходимо войти в аккаунт, чтобы просматривать уведомления.',
      },
      { status: 401 },
    )
  }

  const body = (await request.json().catch(() => ({}))) || {}
  const location = body?.location || session.user.location

  if (!location) {
    return NextResponse.json(
      {
        success: false,
        error: 'Не удалось определить игровой регион для уведомлений.',
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
          error: 'Глобальная база недоступна для уведомлений.',
        },
        { status: 503 },
      )
    }

    const Notifications = db.model('Notifications')
    const ids = body?.notificationIds

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Не переданы идентификаторы уведомлений для обновления.',
        },
        { status: 400 },
      )
    }

    const objectIds = ids
      .map((value) => {
        try {
          return new mongoose.Types.ObjectId(value)
        } catch (error) {
          return null
        }
      })
      .filter(Boolean)

    if (!objectIds.length) {
      return NextResponse.json(
        { success: false, error: 'Некорректные идентификаторы уведомлений.' },
        { status: 400 },
      )
    }

    const updatedAt = new Date()

    const result = await Notifications.updateMany(
      {
        _id: { $in: objectIds },
        userId,
        location,
        readAt: { $exists: true, $eq: null },
      },
      {
        $set: {
          readAt: updatedAt,
        },
      },
    )

    return NextResponse.json(
      {
        success: true,
        modifiedCount: result?.modifiedCount || 0,
        readAt: updatedAt.toISOString(),
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('Notifications API error', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Не удалось обработать запрос к уведомлениям.',
      },
      { status: 500 },
    )
  }
}
