import { getServerSession } from 'next-auth/next'

import { authOptions } from '../../auth/[...nextauth]'
import dbConnect from '@utils/dbConnect'

const normalizeUserAgent = (value) => {
  if (!value || typeof value !== 'string') return null
  return value.slice(0, 500)
}

const ensureUser = async ({ db, session }) => {
  const Users = db.model('Users')
  const telegramId = session.user.telegramId

  let user = await Users.findOne({ telegramId })

  if (user) {
    return user
  }

  user = await Users.create({
    telegramId,
    name: session.user?.name || 'Участник',
    username: session.user?.username ?? null,
    photoUrl: session.user?.photoUrl ?? null,
    languageCode: session.user?.languageCode ?? null,
    isPremium: session.user?.isPremium ?? false,
    role: session.user?.role ?? 'client',
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

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions)

  if (!session?.user?.telegramId) {
    return res
      .status(401)
      .json({ success: false, error: 'Авторизуйтесь через Telegram, чтобы управлять уведомлениями.' })
  }

  const location = req.body?.location || req.query?.location || session.user.location

  if (!location) {
    return res
      .status(400)
      .json({ success: false, error: 'Не удалось определить игровую площадку для уведомлений.' })
  }

  try {
    const db = await dbConnect(location)

    if (!db) {
      return res
        .status(400)
        .json({ success: false, error: 'Указан неизвестный регион для уведомлений.' })
    }

    const Users = db.model('Users')
    const telegramId = session.user.telegramId

    if (req.method === 'POST') {
      const preparedSubscription = buildSubscription({
        subscription: req.body?.subscription,
        userAgent: req.body?.userAgent,
      })

      if (!preparedSubscription) {
        return res
          .status(400)
          .json({ success: false, error: 'Некорректные данные подписки на уведомления.' })
      }

      const user = await ensureUser({ db, session })

      const subscriptions = Array.isArray(user.pushSubscriptions)
        ? [...user.pushSubscriptions]
        : []

      const existingIndex = subscriptions.findIndex(
        (item) => item && item.endpoint === preparedSubscription.endpoint
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

      return res.status(200).json({
        success: true,
        subscriptionCount: subscriptions.length,
      })
    }

    if (req.method === 'DELETE') {
      const endpoint = req.body?.endpoint || req.query?.endpoint

      if (!endpoint) {
        return res
          .status(400)
          .json({ success: false, error: 'Не указан endpoint подписки для удаления.' })
      }

      const result = await Users.updateOne(
        { telegramId },
        {
          $pull: {
            pushSubscriptions: {
              endpoint,
            },
          },
        }
      )

      return res.status(200).json({
        success: true,
        removedCount: result?.modifiedCount || 0,
      })
    }

    res.setHeader('Allow', ['POST', 'DELETE'])
    return res.status(405).json({ success: false, error: 'Метод не поддерживается.' })
  } catch (error) {
    console.error('Push subscription error', error)
    return res
      .status(500)
      .json({ success: false, error: 'Не удалось обновить подписку на push-уведомления.' })
  }
}
