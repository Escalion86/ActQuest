import { NextResponse } from 'next/server'

import dbConnectGlobal from '@utils/dbConnectGlobal'
import normalizeAuthPhone from '@helpers/normalizeAuthPhone'
import { verifyPhoneVerificationCode } from '@helpers/phoneVerificationCode'

const MAX_SMS_ATTEMPTS = 5

const errorJson = (status, type, message) =>
  NextResponse.json(
    { success: false, error: { type, message } },
    { status },
  )

export async function POST(request) {
  const body = await request.json().catch(() => ({}))
  const phone = normalizeAuthPhone(body?.phone)
  const flow = String(body?.flow || 'register').trim().toLowerCase()
  const code = String(body?.code || '').trim()

  if (!phone) {
    return errorJson(400, 'phone', 'Укажите корректный номер телефона.')
  }
  if (!['register', 'recovery', 'change_phone'].includes(flow)) {
    return errorJson(400, 'flow', 'Некорректный тип операции.')
  }
  if (!/^\d{4}$/.test(code)) {
    return errorJson(400, 'code', 'Введите четырёхзначный код из SMS.')
  }

  try {
    const globalDb = await dbConnectGlobal()
    if (!globalDb) {
      return errorJson(503, 'unknown', 'Не удалось подключиться к базе.')
    }

    const PhoneVerifications = globalDb.model('PhoneVerifications')
    const verification = await PhoneVerifications.findOne({ phone, flow }).lean()

    if (!verification || verification.verificationMethod !== 'sms') {
      return errorJson(404, 'not_found', 'Запрос SMS-подтверждения не найден.')
    }
    if (
      verification.expiresAt &&
      new Date(verification.expiresAt).getTime() <= Date.now()
    ) {
      return errorJson(400, 'expired', 'Срок действия SMS-кода истёк.')
    }
    if (Number(verification.smsAttempts || 0) >= MAX_SMS_ATTEMPTS) {
      return errorJson(
        429,
        'attempts',
        'Превышено количество попыток. Запросите новый SMS-код.',
      )
    }

    const valid = verifyPhoneVerificationCode(
      code,
      verification.smsCodeHash,
      verification.smsCodeSalt,
    )

    if (!valid) {
      await PhoneVerifications.updateOne(
        { _id: verification._id },
        { $inc: { smsAttempts: 1 } },
      )
      return errorJson(400, 'code', 'Неверный код из SMS.')
    }

    await PhoneVerifications.updateOne(
      { _id: verification._id },
      {
        $set: {
          confirmed: true,
          providerStatus: 'ok',
        },
        $unset: {
          smsCodeHash: 1,
          smsCodeSalt: 1,
        },
      },
    )

    return NextResponse.json({
      success: true,
      data: { status: 'ok' },
    })
  } catch (error) {
    console.error('Phone verify SMS check error', error)
    return errorJson(500, 'unknown', 'Не удалось проверить SMS-код.')
  }
}
