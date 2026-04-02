import { getServerSession } from 'next-auth/next'

import { authOptions } from '@pages/api/auth/[...nextauth]'
import isUserAdmin from '@helpers/isUserAdmin'
import dbConnectGlobal from '@utils/dbConnectGlobal'
import { broadcastNotificationToUsers } from '@server/pwaNotifications'

const sanitizeText = (value) => (typeof value === 'string' ? value.trim() : '')

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({
      success: false,
      error: 'Метод не поддерживается',
    })
  }

  const session = await getServerSession(req, res, authOptions)
  if (!session?.user || !isUserAdmin({ role: session.user.role })) {
    return res.status(403).json({ success: false, error: 'Недостаточно прав' })
  }

  const userId = sanitizeText(req.body?.userId)
  const message = sanitizeText(req.body?.message)

  if (!userId) {
    return res.status(400).json({
      success: false,
      error: 'Не указан пользователь для отправки уведомления',
    })
  }

  if (!message) {
    return res.status(400).json({
      success: false,
      error: 'Введите сообщение для отправки',
    })
  }

  if (message.length > 1200) {
    return res.status(400).json({
      success: false,
      error: 'Сообщение слишком длинное. Максимум 1200 символов.',
    })
  }

  try {
    const db = await dbConnectGlobal()
    if (!db) {
      return res.status(503).json({
        success: false,
        error: 'База пользователей недоступна',
      })
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
      return res.status(404).json({
        success: false,
        error: 'Пользователь не найден',
      })
    }

    const userTelegramId = Number(user?.telegramId)
    if (!Number.isFinite(userTelegramId)) {
      return res.status(400).json({
        success: false,
        error: 'У пользователя не указан Telegram ID для отправки уведомлений',
      })
    }

    const location =
      sanitizeText(user?.currentLocation) ||
      sanitizeText(user?.accountLocation) ||
      sanitizeText(session?.user?.location) ||
      'global'

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

    return res.status(200).json({
      success: true,
      data: {
        created: Number(result?.created || 0),
        delivered: Number(result?.delivered || 0),
        removed: Number(result?.removed || 0),
      },
    })
  } catch (error) {
    console.error('Failed to send admin push to user', error)
    return res.status(500).json({
      success: false,
      error: 'Не удалось отправить push-уведомление пользователю',
    })
  }
}
