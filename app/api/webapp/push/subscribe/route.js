import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import dbConnectGlobal from '@utils/dbConnectGlobal'
import { authOptions } from '@server/auth/authOptions'

const normalizeUserAgent = (value) => {
  if (!value || typeof value !== 'string') return null
  return value.slice(0, 500)
}

const getSessionUserId = (session) => {
  const rawId =
    session?.user?.globalUserId ||
    session?.user?.userId ||
    session?.user?._id ||
    session?.user?.id ||
    null

  return rawId ? String(rawId) : ''
}

const getSessionTelegramId = (session) => {
  const telegramId = Number(session?.user?.telegramId)
  return Number.isFinite(telegramId) ? telegramId : null
}

const isObjectIdString = (value) => /^[0-9a-fA-F]{24}$/.test(String(value || ''))

const ensureUser = async ({ db, session }) => {
  const Users = db.model('Users')
  const userId = getSessionUserId(session)
  const telegramId = getSessionTelegramId(session)

  let user = isObjectIdString(userId) ? await Users.findById(userId) : null

  if (user) {
    return user
  }

  if (telegramId !== null) {
    user = await Users.findOne({ telegramId })
  }

  if (user) {
    return user
  }

  user = await Users.create({
    ...(isObjectIdString(userId) ? { _id: userId } : {}),
    ...(telegramId !== null ? { telegramId } : {}),
    name: session.user?.name || 'Участник',
    username: session.user?.username ?? null,
    photoUrl: session.user?.photoUrl ?? null,
    languageCode: session.user?.languageCode ?? null,
    isPremium: session.user?.isPremium ?? false,
    role: session.user?.role ?? 'client',
    currentLocation: session.user?.location ?? null,
  })

  return user
}

const buildSubscription = ({ subscription, userAgent }) => {
  const endpoint = subscription?.endpoint
  const p256dh = subscription?.keys?.p256dh
  const auth = subscription?.keys?.auth

  if (!endpoint || !p256dh || !auth) {
    return null
  }

  return {
    endpoint,
    keys: {
      p256dh,
      auth,
    },
    expirationTime: subscription?.expirationTime ?? null,
    userAgent: normalizeUserAgent(userAgent),
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

export async function POST(request) {
  const session = await getServerSession(authOptions)
  const sessionUserId = getSessionUserId(session)
  const sessionTelegramId = getSessionTelegramId(session)

  if (!isObjectIdString(sessionUserId) && sessionTelegramId === null) {
    return NextResponse.json(
      {
        success: false,
        error: 'Авторизуйтесь, чтобы управлять уведомлениями.',
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
        error: 'Не удалось определить игровую площадку для уведомлений.',
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

    const preparedSubscription = buildSubscription({
      subscription: body?.subscription,
      userAgent: body?.userAgent,
    })

    if (!preparedSubscription) {
      return NextResponse.json(
        {
          success: false,
          error: 'Некорректные данные подписки на уведомления.',
        },
        { status: 400 },
      )
    }

    const user = await ensureUser({ db, session })

    const subscriptions = Array.isArray(user.pushSubscriptions)
      ? [...user.pushSubscriptions]
      : []

    const existingIndex = subscriptions.findIndex(
      (item) => item && item.endpoint === preparedSubscription.endpoint,
    )

    if (existingIndex >= 0) {
      const existing = subscriptions[existingIndex]
      subscriptions[existingIndex] = {
        ...existing,
        ...preparedSubscription,
        createdAt: existing?.createdAt || preparedSubscription.createdAt,
        updatedAt: new Date(),
      }
    } else {
      subscriptions.push(preparedSubscription)
    }

    const MAX_SUBSCRIPTIONS = 10
    if (subscriptions.length > MAX_SUBSCRIPTIONS) {
      subscriptions.splice(0, subscriptions.length - MAX_SUBSCRIPTIONS)
    }

    user.pushSubscriptions = subscriptions
    user.markModified?.('pushSubscriptions')
    await user.save()

    return NextResponse.json(
      {
        success: true,
        subscriptionCount: subscriptions.length,
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('Push subscription error', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Не удалось обновить подписку на push-уведомления.',
      },
      { status: 500 },
    )
  }
}

export async function DELETE(request) {
  const session = await getServerSession(authOptions)

  const sessionUserId = getSessionUserId(session)

  const sessionTelegramId = getSessionTelegramId(session)

  if (!isObjectIdString(sessionUserId) && sessionTelegramId === null) {
    return NextResponse.json(
      {
        success: false,
        error: 'Авторизуйтесь, чтобы управлять уведомлениями.',
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
        error: 'Не удалось определить игровую площадку для уведомлений.',
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

    const Users = db.model('Users')
    const endpoint = body?.endpoint || request.nextUrl.searchParams.get('endpoint')

    if (!endpoint) {
      return NextResponse.json(
        { success: false, error: 'Не указан endpoint подписки для удаления.' },
        { status: 400 },
      )
    }

    const userFilter =
      isObjectIdString(sessionUserId)
        ? { _id: sessionUserId }
        : { telegramId: sessionTelegramId }

    const result = await Users.updateOne(
      userFilter,
      {
        $pull: {
          pushSubscriptions: {
            endpoint,
          },
        },
      },
    )

    return NextResponse.json(
      {
        success: true,
        removedCount: result?.modifiedCount || 0,
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('Push subscription error', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Не удалось обновить подписку на push-уведомления.',
      },
      { status: 500 },
    )
  }
}
