import { getServerSession } from 'next-auth/next'

import { authOptions } from '@pages/api/auth/[...nextauth]'
import isUserAdmin from '@helpers/isUserAdmin'
import dbConnectGlobal from '@utils/dbConnectGlobal'
import sendMessage from 'telegram/sendMessage'

const CITY_BOT_LOCATIONS = ['krsk', 'nrsk', 'ekb']
const TELEGRAM_TOKEN_ENV_BY_LOCATION = {
  krsk: 'TELEGRAM_KRSK_TOKEN',
  nrsk: 'TELEGRAM_NRSK_TOKEN',
  ekb: 'TELEGRAM_EKB_TOKEN',
}

const getConfiguredLocations = () =>
  CITY_BOT_LOCATIONS.filter((locationKey) => {
    const envKey = TELEGRAM_TOKEN_ENV_BY_LOCATION[locationKey]
    const token = typeof envKey === 'string' ? process.env[envKey] : null
    return typeof token === 'string' && token.trim().length > 0
  })

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

  const requestedUserId = req.body?.userId ? String(req.body.userId) : null

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

    const configuredLocations = getConfiguredLocations()
    if (configuredLocations.length === 0) {
      return res.status(500).json({
        success: false,
        error: 'Не настроены Telegram токены городских ботов',
      })
    }

    const messagePayload = {
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
    }

    const sendResults = await Promise.allSettled(
      configuredLocations.map((locationKey) =>
        sendMessage({
          ...messagePayload,
          location: locationKey,
        })
      )
    )

    const sentLocations = []
    const failedLocations = []

    sendResults.forEach((result, index) => {
      const locationKey = configuredLocations[index]
      if (result.status === 'fulfilled') {
        sentLocations.push(locationKey)
        return
      }

      failedLocations.push(locationKey)
    })

    if (sentLocations.length === 0) {
      return res.status(500).json({
        success: false,
        error: 'Не удалось отправить запрос номера ни в один городской бот',
      })
    }

    return res.status(200).json({
      success: true,
      data: {
        userId: String(user._id),
        globalUserId: String(user._id),
        telegramId: Number(user.telegramId),
        phoneAlreadySet: Number.isFinite(Number(user.phone)),
        sentLocations,
        failedLocations,
      },
    })
  } catch (error) {
    console.error('Failed to request user phone via Telegram', error)
    return res
      .status(500)
      .json({ success: false, error: 'Не удалось отправить запрос номера' })
  }
}
