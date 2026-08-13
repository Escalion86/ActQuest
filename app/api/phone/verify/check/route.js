import { NextResponse } from 'next/server'

import dbConnectGlobal from '@utils/dbConnectGlobal'
import normalizeAuthPhone from '@helpers/normalizeAuthPhone'
import {
  checkTelefonipReverseCall,
  normalizeAuthPhone7,
} from '@helpers/telefonipAuthCalls'

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

const resolveStatusFromProvider = (providerData = {}) => {
  const rawStatus = String(
    providerData?.data?.status ||
      providerData?.status ||
      providerData?.error ||
      '',
  ).toLowerCase()

  if (rawStatus.includes('expire')) return 'expired'
  if (rawStatus.includes('timeout')) return 'expired'
  if (rawStatus.includes('ok')) return 'ok'

  return 'pending'
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}))
  const phone = normalizeAuthPhone(body?.phone)
  const flow = String(body?.flow || 'register').trim().toLowerCase()
  const callId = Number(body?.callId)

  if (!phone) {
    return errorJson(400, 'phone', 'Укажите корректный номер телефона.')
  }
  if (!Number.isFinite(callId)) {
    return errorJson(400, 'phone', 'Некорректный идентификатор звонка.')
  }
  if (!['register', 'recovery', 'change_phone'].includes(flow)) {
    return errorJson(400, 'flow', 'Некорректный тип операции.')
  }

  try {
    const globalDb = await dbConnectGlobal()
    if (!globalDb) {
      return errorJson(
        503,
        'unknown',
        'Не удалось подключиться к базе. Попробуйте позже.',
      )
    }

    const PhoneVerifications = globalDb.model('PhoneVerifications')
    const verification = await PhoneVerifications.findOne({ phone, flow }).lean()

    if (!verification || Number(verification.callId) !== callId) {
      return errorJson(
        404,
        'not_found',
        'Запрос подтверждения не найден. Запустите проверку снова.',
      )
    }

    if (verification.confirmed) {
      return NextResponse.json(
        {
          success: true,
          data: { status: 'ok' },
        },
        { status: 200 },
      )
    }

    const provider = await checkTelefonipReverseCall(callId)
    const providerData = provider?.data || {}
    const providerStatusRaw = resolveStatusFromProvider(providerData)
    const providerPhone = normalizeAuthPhone7(providerData?.data?.phone)
    const verificationExpired =
      (verification.callExpiresAt || verification.expiresAt) &&
      new Date(verification.callExpiresAt || verification.expiresAt).getTime() <=
        Date.now()

    // По контракту Telefon-IP успешный ответ может содержать только data.phone
    // и data.id, без status="ok". Возвращённый провайдером номер — основной
    // признак успешного подтверждения.
    const confirmed = providerPhone !== null && providerPhone === phone
    const providerStatus = confirmed
      ? 'ok'
      : verificationExpired
        ? 'expired'
        : providerStatusRaw

    await PhoneVerifications.findOneAndUpdate(
      { _id: verification._id },
      {
        $set: {
          providerStatus,
          confirmed,
          meta: {
            ...(verification.meta || {}),
            checkResponse: providerData,
          },
        },
      },
    )

    return NextResponse.json(
      {
        success: true,
        data: {
          status: providerStatus,
        },
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('Phone verify check error (app)', error)
    return errorJson(
      500,
      'unknown',
      'Не удалось проверить статус подтверждения. Попробуйте позже.',
    )
  }
}
