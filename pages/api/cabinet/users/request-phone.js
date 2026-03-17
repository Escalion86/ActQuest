import { getServerSession } from 'next-auth/next'

import { authOptions } from '@pages/api/auth/[...nextauth]'
import isUserAdmin from '@helpers/isUserAdmin'
import dbConnectGlobal from '@utils/dbConnectGlobal'
import sendMessage from 'telegram/sendMessage'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res
      .status(405)
      .json({ success: false, error: 'Метод не поддерживается' })
  }

  const session = await getServerSession(req, res, authOptions)
  if (!session?.user || !isUserAdmin({ role: session.user.role })) {
    return res.status(403).json({ success: false, error: 'Недостаточно прав' })
  }

  const location = session?.user?.location ?? null
  const requestedUserId = req.body?.userId ? String(req.body.userId) : null

  if (!location) {
    return res
      .status(400)
      .json({ success: false, error: 'Не удалось определить площадку' })
  }

  if (!requestedUserId) {
    return res
      .status(400)
      .json({ success: false, error: 'Не передан пользователь' })
  }

  try {
    const globalDb = await dbConnectGlobal()

    if (!globalDb) {
      return res
        .status(500)
        .json({ success: false, error: 'Не удалось подключиться к глобальной базе данных' })
    }

    const globalUsers = globalDb.model('Users')
    const user = await globalUsers
      .findById(requestedUserId)
      .select({ _id: 1, telegramId: 1, phone: 1, name: 1 })
      .lean()

    if (!user) {
      return res
        .status(404)
        .json({ success: false, error: 'Пользователь не найден' })
    }

    if (!Number.isFinite(Number(user.telegramId))) {
      return res.status(400).json({
        success: false,
        error: 'У пользователя не указан telegramId',
      })
    }

    await sendMessage({
      chat_id: Number(user.telegramId),
      text:
        'Администратор запросил подтверждение номера телефона для вашего аккаунта ActQuest.\n\n' +
        'Нажмите кнопку ниже и отправьте ваш контакт из Telegram.',
      keyboard: {
        keyboard: [
          [
            {
              text: 'Отправить мой номер телефона',
              request_contact: true,
            },
          ],
        ],
        one_time_keyboard: true,
      },
      location,
    })

    return res.status(200).json({
      success: true,
      data: {
        userId: String(user._id),
        globalUserId: String(user._id),
        telegramId: Number(user.telegramId),
        phoneAlreadySet: Number.isFinite(Number(user.phone)),
      },
    })
  } catch (error) {
    console.error('Failed to request user phone via Telegram', error)
    return res
      .status(500)
      .json({ success: false, error: 'Не удалось отправить запрос номера' })
  }
}
