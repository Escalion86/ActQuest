import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import normalizeAuthPhone from '@helpers/normalizeAuthPhone'
import resolveSessionUserFilter from '@helpers/resolveSessionUserFilter'
import dbConnectGlobal from '@utils/dbConnectGlobal'
import isMongoDuplicatePhoneError from '@helpers/isMongoDuplicatePhoneError'

const FLOW = 'change_phone'

const errorJson = (status, message) =>
  NextResponse.json(
    {
      success: false,
      error: message,
    },
    { status },
  )

export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return errorJson(401, 'Необходима авторизация')
  }

  const body = await request.json().catch(() => ({}))
  const phone = normalizeAuthPhone(body?.phone)
  const callId = Number(body?.callId)

  if (!phone) {
    return errorJson(400, 'Укажите корректный номер телефона.')
  }
  if (!Number.isFinite(callId)) {
    return errorJson(400, 'Некорректный идентификатор звонка.')
  }

  const userFilter = resolveSessionUserFilter(session.user)
  if (!userFilter) {
    return errorJson(400, 'Не удалось определить пользователя.')
  }

  try {
    const globalDb = await dbConnectGlobal()
    if (!globalDb) {
      return errorJson(503, 'Глобальная база пользователей недоступна')
    }

    const Users = globalDb.model('Users')
    const PhoneVerifications = globalDb.model('PhoneVerifications')

    const currentUser = await Users.findOne(userFilter).select({ _id: 1, phone: 1 }).lean()
    if (!currentUser?._id) {
      return errorJson(404, 'Пользователь не найден.')
    }

    if (Number(currentUser.phone) === phone) {
      await PhoneVerifications.deleteMany({ phone, flow: FLOW })
      return NextResponse.json(
        {
          success: true,
          data: currentUser,
        },
        { status: 200 },
      )
    }

    const verification = await PhoneVerifications.findOne({ phone, flow: FLOW }).lean()
    if (!verification || Number(verification.callId) !== callId || !verification.confirmed) {
      return errorJson(
        400,
        'Номер телефона не подтвержден. Сначала завершите проверку звонком.',
      )
    }

    if (verification.expiresAt && new Date(verification.expiresAt).getTime() <= Date.now()) {
      return errorJson(400, 'Время подтверждения истекло. Запросите звонок повторно.')
    }

    const existingUserWithPhone = await Users.findOne({ phone }).select({ _id: 1 }).lean()
    if (
      existingUserWithPhone?._id &&
      String(existingUserWithPhone._id) !== String(currentUser._id)
    ) {
      return errorJson(400, 'Такой номер уже зарегистрирован в другом профиле.')
    }

    const updatedUser = await Users.findByIdAndUpdate(
      currentUser._id,
      {
        $set: {
          phone,
        },
      },
      { returnDocument: 'after' },
    ).lean()

    await PhoneVerifications.deleteMany({ phone, flow: FLOW })

    return NextResponse.json(
      {
        success: true,
        data: updatedUser,
      },
      { status: 200 },
    )
  } catch (error) {
    if (isMongoDuplicatePhoneError(error)) {
      return errorJson(400, 'Такой номер уже зарегистрирован в другом профиле.')
    }

    console.error('Failed to change user phone (app)', error)
    return errorJson(500, 'Не удалось обновить номер телефона. Попробуйте позже.')
  }
}

