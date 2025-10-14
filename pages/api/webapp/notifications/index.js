import mongoose from 'mongoose'
import { getServerSession } from 'next-auth/next'

import { authOptions } from '../../auth/[...nextauth]'
import dbConnect from '@utils/dbConnect'

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

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions)

  if (!session?.user?.telegramId) {
    return res
      .status(401)
      .json({ success: false, error: 'Необходимо войти через Telegram, чтобы просматривать уведомления.' })
  }

  const location = req.method === 'GET'
    ? req.query?.location || session.user.location
    : req.body?.location || session.user.location

  if (!location) {
    return res
      .status(400)
      .json({ success: false, error: 'Не удалось определить игровой регион для уведомлений.' })
  }

  try {
    const db = await dbConnect(location)

    if (!db) {
      return res
        .status(400)
        .json({ success: false, error: 'Указан неизвестный регион для уведомлений.' })
    }

    const Notifications = db.model('Notifications')
    const telegramId = session.user.telegramId

    if (req.method === 'GET') {
      const limitParam = Array.isArray(req.query?.limit) ? req.query.limit[0] : req.query?.limit
      const limit = Math.min(Math.max(parseInt(limitParam || '50', 10), 1), 200)

      const notifications = await Notifications.find({
        userTelegramId: telegramId,
      })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean()

      return res.status(200).json({
        success: true,
        notifications: notifications.map(mapNotification),
      })
    }

    if (req.method === 'PATCH') {
      const ids = req.body?.notificationIds

      if (!Array.isArray(ids) || ids.length === 0) {
        return res
          .status(400)
          .json({ success: false, error: 'Не переданы идентификаторы уведомлений для обновления.' })
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
        return res
          .status(400)
          .json({ success: false, error: 'Некорректные идентификаторы уведомлений.' })
      }

      const updatedAt = new Date()

      const result = await Notifications.updateMany(
        {
          _id: { $in: objectIds },
          userTelegramId: telegramId,
          readAt: { $exists: true, $eq: null },
        },
        {
          $set: {
            readAt: updatedAt,
          },
        }
      )

      return res.status(200).json({
        success: true,
        modifiedCount: result?.modifiedCount || 0,
        readAt: updatedAt.toISOString(),
      })
    }

    res.setHeader('Allow', ['GET', 'PATCH'])
    return res.status(405).json({ success: false, error: 'Метод не поддерживается.' })
  } catch (error) {
    console.error('Notifications API error', error)
    return res
      .status(500)
      .json({ success: false, error: 'Не удалось обработать запрос к уведомлениям.' })
  }
}
