import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
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

export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user || !isUserAdmin({ role: session.user.role })) {
    return NextResponse.json(
      { success: false, error: 'Недостаточно прав' },
      { status: 403 },
    )
  }

  const body = await request.json().catch(() => ({}))
  const requestedUserId = body?.userId ? String(body.userId) : null

  if (!requestedUserId) {
    return NextResponse.json(
      { success: false, error: 'Не передан пользователь' },
      { status: 400 },
    )
  }

  try {
    const globalDb = await dbConnectGlobal()

    if (!globalDb) {
      return NextResponse.json(
        {
          success: false,
          error: 'Не удалось подключиться к глобальной базе данных',
        },
        { status: 500 },
      )
    }

    const globalUsers = globalDb.model('Users')
    const user = await globalUsers
      .findById(requestedUserId)
      .select({ _id: 1, telegramId: 1, phone: 1, name: 1 })
      .lean()

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Пользователь не найден' },
        { status: 404 },
      )
    }

    if (!Number.isFinite(Number(user.telegramId))) {
      return NextResponse.json(
        {
          success: false,
          error: 'У пользователя не указан telegramId',
        },
        { status: 400 },
      )
    }

    const configuredLocations = getConfiguredLocations()
    if (configuredLocations.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Не настроены Telegram токены городских ботов',
        },
        { status: 500 },
      )
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
        }),
      ),
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
      return NextResponse.json(
        {
          success: false,
          error: 'Не удалось отправить запрос номера ни в один городской бот',
        },
        { status: 500 },
      )
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          userId: String(user._id),
          globalUserId: String(user._id),
          telegramId: Number(user.telegramId),
          phoneAlreadySet: Number.isFinite(Number(user.phone)),
          sentLocations,
          failedLocations,
        },
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('Failed to request user phone via Telegram (app)', error)
    return NextResponse.json(
      { success: false, error: 'Не удалось отправить запрос номера' },
      { status: 500 },
    )
  }
}
