import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import dbConnectGlobal from '@utils/dbConnectGlobal'
import normalizeAuthPhone from '@helpers/normalizeAuthPhone'
import { getSiteAccessControlsByLocation } from '@helpers/siteAccessControls'
import { startTelefonipReverseCall } from '@helpers/telefonipAuthCalls'
import resolveSessionUserFilter from '@helpers/resolveSessionUserFilter'
import { authOptions } from '@server/auth/authOptions'

const START_RATE_LIMIT_MS = 60 * 1000
const VERIFY_TTL_MS = 15 * 60 * 1000

const errorJson = (status, type, message) =>
  NextResponse.json(
    {
      success: false,
      error: {
        type,
        message,
      },
    },
    { status },
  )

export async function POST(request) {
  const body = await request.json().catch(() => ({}))
  const phone = normalizeAuthPhone(body?.phone)
  const flow = String(body?.flow || 'register').trim().toLowerCase()
  const location =
    typeof body?.location === 'string' ? body.location.trim().toLowerCase() : null

  if (!phone) {
    return errorJson(400, 'phone', 'Укажите корректный номер телефона.')
  }
  if (!['register', 'recovery', 'change_phone'].includes(flow)) {
    return errorJson(400, 'flow', 'Некорректный тип операции.')
  }

  try {
    if (flow === 'register') {
      if (!location) {
        return errorJson(
          400,
          'location',
          'Выберите город, в котором хотите зарегистрироваться.',
        )
      }
      const controls = await getSiteAccessControlsByLocation(location)
      if (!controls.allowSiteRegistration) {
        return errorJson(
          403,
          'forbidden',
          'Регистрация на сайте временно отключена для выбранного региона.',
        )
      }
    }

    const globalDb = await dbConnectGlobal()
    if (!globalDb) {
      return errorJson(
        503,
        'unknown',
        'Не удалось подключиться к базе. Попробуйте позже.',
      )
    }

    const Users = globalDb.model('Users')
    const PhoneVerifications = globalDb.model('PhoneVerifications')

    const existingUser = await Users.findOne({ phone })
      .select({ _id: 1, passwordHash: 1 })
      .lean()

    if (flow === 'change_phone') {
      const session = await getServerSession(authOptions)
      if (!session?.user) {
        return errorJson(401, 'auth', 'Необходима авторизация.')
      }

      const sessionFilter = resolveSessionUserFilter(session.user)
      if (!sessionFilter) {
        return errorJson(400, 'auth', 'Не удалось определить пользователя.')
      }

      const currentUser = await Users.findOne(sessionFilter)
        .select({ _id: 1, phone: 1 })
        .lean()
      if (!currentUser?._id) {
        return errorJson(404, 'not_found', 'Пользователь не найден.')
      }

      if (Number(currentUser.phone) === phone) {
        return errorJson(400, 'phone', 'Указан текущий номер телефона.')
      }

      if (existingUser && String(existingUser._id) !== String(currentUser._id)) {
        return errorJson(
          400,
          'phone',
          'Такой номер уже зарегистрирован в другом профиле.',
        )
      }
    }

    if (flow === 'register' && existingUser?.passwordHash) {
      return errorJson(
        400,
        'phone',
        'Такой номер уже зарегистрирован. Войдите по номеру телефона или через VK.',
      )
    }

    if (flow === 'recovery' && !existingUser) {
      return errorJson(404, 'not_found', 'Аккаунт с таким номером не найден.')
    }

    const latest = await PhoneVerifications.findOne({ phone, flow })
      .sort({ updatedAt: -1 })
      .lean()

    if (latest?.updatedAt) {
      const diffMs = Date.now() - new Date(latest.updatedAt).getTime()
      if (diffMs < START_RATE_LIMIT_MS) {
        return errorJson(
          429,
          'rate_limit',
          'Слишком частый запрос. Повторите через минуту.',
        )
      }
    }

    const provider = await startTelefonipReverseCall(phone)
    const providerData = provider?.data

    if (!providerData?.success || !providerData?.data?.id) {
      return errorJson(
        502,
        'unknown',
        'Не удалось запустить подтверждение звонком. Попробуйте позже.',
      )
    }

    const callId = Number(providerData.data.id)
    const authPhone = providerData.data.auth_phone || null
    const imageUrl = providerData.data.url_image || null
    const expiresAt = new Date(Date.now() + VERIFY_TTL_MS)

    await PhoneVerifications.findOneAndUpdate(
      { phone, flow },
      {
        $set: {
          phone,
          flow,
          callId,
          authPhone,
          imageUrl,
          confirmed: false,
          providerStatus: 'pending',
          expiresAt,
          meta: {
            startResponse: providerData,
          },
        },
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      },
    )

    return NextResponse.json(
      {
        success: true,
        data: {
          id: callId,
          auth_phone: authPhone,
          url_image: imageUrl,
          expiresAt: expiresAt.toISOString(),
        },
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('Phone verify start error (app)', error)
    return errorJson(
      500,
      'unknown',
      'Не удалось запустить проверку телефона. Попробуйте позже.',
    )
  }
}
