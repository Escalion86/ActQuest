import { NextResponse } from 'next/server'

import dbConnectGlobal from '@utils/dbConnectGlobal'
import normalizeAuthPhone from '@helpers/normalizeAuthPhone'
import { startTelefonipSmsCode } from '@helpers/telefonipAuthCalls'
import { createPhoneVerificationCodeHash } from '@helpers/phoneVerificationCode'
import { getSiteAccessControlsByLocation } from '@helpers/siteAccessControls'

const SMS_TTL_MS = 10 * 60 * 1000
const SMS_RATE_LIMIT_MS = 60 * 1000

const isTelefonipDailyLimitError = (value) => {
  const message = String(value || '').toLowerCase()
  return (
    message.includes('number of shipments') ||
    message.includes('quantity limit per day') ||
    message.includes('limit per day')
  )
}

const errorJson = (status, type, message) =>
  NextResponse.json(
    { success: false, error: { type, message } },
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
    const controls = await getSiteAccessControlsByLocation(location)
    if (!controls.allowSmsVerification) {
      return errorJson(
        403,
        'forbidden',
        'Подтверждение номера по SMS временно отключено.',
      )
    }

    const globalDb = await dbConnectGlobal()
    if (!globalDb) {
      return errorJson(503, 'unknown', 'Не удалось подключиться к базе.')
    }

    const PhoneVerifications = globalDb.model('PhoneVerifications')
    const verification = await PhoneVerifications.findOne({ phone, flow }).lean()

    if (!verification) {
      return errorJson(
        404,
        'not_found',
        'Сначала запустите подтверждение номера звонком.',
      )
    }

    if (verification.smsSentAt) {
      const sinceLastSms = Date.now() - new Date(verification.smsSentAt).getTime()
      if (sinceLastSms < SMS_RATE_LIMIT_MS) {
        return errorJson(
          429,
          'rate_limit',
          'SMS уже отправлено. Повторный запрос доступен через минуту.',
        )
      }
    }

    const provider = await startTelefonipSmsCode(phone)
    const providerData = provider?.data || {}
    const smsCode = String(providerData?.data?.code || '').trim()

    if (!providerData?.success || !/^\d{4}$/.test(smsCode)) {
      const providerError = String(providerData?.error || '').trim()
      console.error('Telefon-IP SMS start failed', {
        success: providerData?.success,
        errorType: isTelefonipDailyLimitError(providerError)
          ? 'daily_limit'
          : 'provider_error',
      })
      if (isTelefonipDailyLimitError(providerError)) {
        return errorJson(
          429,
          'daily_limit',
          'Достигнут суточный лимит SMS для этого номера. Попробуйте подтверждение звонком или повторите завтра.',
        )
      }
      return errorJson(
        502,
        'provider',
        'Не удалось отправить SMS-код. Попробуйте позже.',
      )
    }

    const { hash, salt } = createPhoneVerificationCodeHash(smsCode)
    const now = new Date()
    const expiresAt = new Date(now.getTime() + SMS_TTL_MS)

    await PhoneVerifications.updateOne(
      { _id: verification._id },
      {
        $set: {
          verificationMethod: 'sms',
          providerStatus: 'sms_pending',
          confirmed: false,
          smsCodeHash: hash,
          smsCodeSalt: salt,
          smsAttempts: 0,
          smsSentAt: now,
          expiresAt,
          meta: {
            ...(verification.meta || {}),
            smsStartResponse: {
              success: true,
              error: providerData?.error || '',
              data: {
                id: providerData?.data?.id ?? null,
                phone: providerData?.data?.phone ?? null,
              },
            },
          },
        },
      },
    )

    return NextResponse.json({
      success: true,
      data: {
        status: 'sms_pending',
        expiresAt: expiresAt.toISOString(),
      },
    })
  } catch (error) {
    console.error('Phone verify SMS start error', error)
    return errorJson(500, 'unknown', 'Не удалось отправить SMS-код.')
  }
}
