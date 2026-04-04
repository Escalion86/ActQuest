import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import dbConnectGlobal from '@utils/dbConnectGlobal'
import normalizeAuthPhone from '@helpers/normalizeAuthPhone'
import { getSiteAccessControlsByLocation } from '@helpers/siteAccessControls'
import resolveSessionUserFilter from '@helpers/resolveSessionUserFilter'
import { authOptions } from '@server/auth/authOptions'

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

    const existingUser = await globalDb
      .model('Users')
      .findOne({ phone })
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

      const currentUser = await globalDb
        .model('Users')
        .findOne(sessionFilter)
        .select({ _id: 1, phone: 1 })
        .lean()

      if (!currentUser?._id) {
        return errorJson(404, 'not_found', 'Пользователь не найден.')
      }

      if (Number(currentUser.phone) === phone) {
        return NextResponse.json(
          {
            success: true,
            data: {
              allowed: false,
              reason: 'same_phone',
              message: 'Вы указали текущий номер телефона.',
            },
          },
          { status: 200 },
        )
      }

      if (existingUser && String(existingUser._id) !== String(currentUser._id)) {
        return NextResponse.json(
          {
            success: true,
            data: {
              allowed: false,
              reason: 'already_registered',
              message: 'Такой номер уже зарегистрирован в другом профиле.',
            },
          },
          { status: 200 },
        )
      }

      return NextResponse.json(
        {
          success: true,
          data: {
            allowed: true,
            reason: null,
            message: null,
          },
        },
        { status: 200 },
      )
    }

    if (flow === 'register' && existingUser?.passwordHash) {
      return NextResponse.json(
        {
          success: true,
          data: {
            allowed: false,
            reason: 'already_registered',
            message:
              'Такой номер уже зарегистрирован. Войдите по номеру телефона или через VK.',
          },
        },
        { status: 200 },
      )
    }

    if (flow === 'recovery' && !existingUser) {
      return NextResponse.json(
        {
          success: true,
          data: {
            allowed: false,
            reason: 'not_found',
            message: 'Аккаунт с таким номером не найден.',
          },
        },
        { status: 200 },
      )
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          allowed: true,
          reason: null,
          message: null,
        },
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('Phone precheck error (app)', error)
    return errorJson(
      500,
      'unknown',
      'Не удалось проверить номер телефона. Попробуйте позже.',
    )
  }
}
