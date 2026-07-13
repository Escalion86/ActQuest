import { NextResponse } from 'next/server'

import dbConnectGlobal from '@utils/dbConnectGlobal'
import normalizeAuthPhone from '@helpers/normalizeAuthPhone'
import registerPhoneUser from '@helpers/registerPhoneUser'
import { getSiteAccessControlsByLocation } from '@helpers/siteAccessControls'
import { createPasswordHash, validatePassword } from '@helpers/passwordHash'
import logSiteEvent from '@helpers/logSiteEvent'

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
  const password = typeof body?.password === 'string' ? body.password : ''
  const flow = String(body?.flow || 'register').trim().toLowerCase()
  const location =
    typeof body?.location === 'string' ? body.location.trim().toLowerCase() : null

  if (!phone) {
    return errorJson(400, 'phone', 'Укажите корректный номер телефона.')
  }
  if (!password) {
    return errorJson(400, 'phone', 'Укажите пароль.')
  }
  if (!['register', 'recovery'].includes(flow)) {
    return errorJson(400, 'flow', 'Некорректный тип операции.')
  }
  if (!validatePassword(password)) {
    return errorJson(400, 'phone', 'Пароль должен содержать минимум 8 символов.')
  }

  let PhoneVerifications = null
  let verificationLock = null

  const releaseVerificationLock = async () => {
    if (!PhoneVerifications || !verificationLock?._id || !verificationLock?.lockedAt) {
      return
    }
    await PhoneVerifications.updateOne(
      { _id: verificationLock._id, finalizingAt: verificationLock.lockedAt },
      { $unset: { finalizingAt: 1 } },
    ).catch(() => null)
  }

  try {
    if (flow === 'register' && !location) {
      return errorJson(
        400,
        'location',
        'Выберите город, в котором хотите зарегистрироваться.',
      )
    }

    const controls = await getSiteAccessControlsByLocation(location)
    const isFlowAllowed =
      flow === 'register' ? controls.allowSiteRegistration : controls.allowSiteAuth

    if (!isFlowAllowed) {
      return errorJson(
        403,
        'forbidden',
        flow === 'register'
          ? 'Регистрация на сайте временно отключена для выбранного региона.'
          : 'Авторизация на сайте временно отключена для выбранного региона.',
      )
    }

    const globalDb = await dbConnectGlobal()
    if (!globalDb) {
      return errorJson(
        503,
        'unknown',
        'Не удалось подключиться к базе. Попробуйте позже.',
      )
    }

    PhoneVerifications = globalDb.model('PhoneVerifications')
    const lockedAt = new Date()
    const verification = await PhoneVerifications.findOneAndUpdate(
      {
        phone,
        flow,
        confirmed: true,
        expiresAt: { $gt: lockedAt },
        finalizingAt: null,
      },
      { $set: { finalizingAt: lockedAt } },
      { returnDocument: 'after' },
    ).lean()

    if (!verification) {
      return errorJson(
        400,
        'phone',
        'Подтверждение не найдено, истекло или уже обрабатывается. Запустите проверку снова.',
      )
    }
    verificationLock = { _id: verification._id, lockedAt }

    if (flow === 'register') {
      const registerResult = await registerPhoneUser({
        location,
        rawData: JSON.stringify({
          phone,
          password,
        }),
      })

      if (!registerResult.success) {
        await releaseVerificationLock()
        return errorJson(
          400,
          'phone',
          registerResult.errorMessage || 'Не удалось завершить регистрацию.',
        )
      }

      await PhoneVerifications.deleteMany({ phone, flow })

      await logSiteEvent({
        db: globalDb,
        type: 'user_registered',
        location,
        message: 'Зарегистрирован новый пользователь',
        targetUserId: registerResult?.user?.id ?? null,
        actorUserId: registerResult?.user?.id ?? null,
        actorTelegramId: registerResult?.user?.telegramId ?? null,
      })

      return NextResponse.json(
        {
          success: true,
          user: registerResult.user,
        },
        { status: 200 },
      )
    }

    const Users = globalDb.model('Users')
    const updatePayload = {
      passwordHash: createPasswordHash(password),
      authMethod: 'phone',
    }
    if (location) {
      updatePayload.currentLocation = location
    }

    const updatedUser = await Users.findOneAndUpdate(
      { phone },
      { $set: updatePayload },
      { returnDocument: 'after' },
    ).lean()

    if (!updatedUser) {
      return errorJson(404, 'not_found', 'Аккаунт с таким номером не найден.')
    }

    await PhoneVerifications.deleteMany({ phone, flow })

    return NextResponse.json(
      {
        success: true,
        user: {
          id: updatedUser._id.toString(),
          globalUserId: updatedUser._id.toString(),
          telegramId: updatedUser.telegramId,
          vkId: updatedUser.vkId,
          phone: updatedUser.phone,
          location: location || updatedUser.currentLocation || null,
          name: updatedUser.name,
          username: updatedUser.username,
          photoUrl: updatedUser.photoUrl,
          languageCode: updatedUser.languageCode,
          isPremium: updatedUser.isPremium,
          role: updatedUser.role ?? 'client',
          authMethod: 'phone',
        },
      },
      { status: 200 },
    )
  } catch (error) {
    await releaseVerificationLock()
    console.error('Phone verify finalize error (app)', error)
    return errorJson(
      500,
      'unknown',
      flow === 'register'
        ? 'Не удалось завершить регистрацию. Попробуйте позже.'
        : 'Не удалось восстановить пароль. Попробуйте позже.',
    )
  }
}

