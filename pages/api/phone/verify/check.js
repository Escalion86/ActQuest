import dbConnectGlobal from '@utils/dbConnectGlobal'
import normalizeAuthPhone from '@helpers/normalizeAuthPhone'
import {
  checkTelefonipReverseCall,
  normalizeAuthPhone7,
} from '@helpers/telefonipAuthCalls'

const errorJson = (res, status, type, message) =>
  res.status(status).json({
    success: false,
    error: {
      type,
      message,
    },
  })

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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return errorJson(res, 405, 'method', 'Метод не поддерживается')
  }

  const phone = normalizeAuthPhone(req.body?.phone)
  const flow = String(req.body?.flow || 'register').trim().toLowerCase()
  const callId = Number(req.body?.callId)

  if (!phone) {
    return errorJson(res, 400, 'phone', 'Укажите корректный номер телефона.')
  }
  if (!Number.isFinite(callId)) {
    return errorJson(res, 400, 'phone', 'Некорректный идентификатор звонка.')
  }
  if (!['register', 'recovery'].includes(flow)) {
    return errorJson(res, 400, 'flow', 'Некорректный тип операции.')
  }

  try {
    const globalDb = await dbConnectGlobal()
    if (!globalDb) {
      return errorJson(
        res,
        503,
        'unknown',
        'Не удалось подключиться к базе. Попробуйте позже.',
      )
    }

    const PhoneVerifications = globalDb.model('PhoneVerifications')
    const verification = await PhoneVerifications.findOne({ phone, flow }).lean()

    if (!verification || Number(verification.callId) !== callId) {
      return errorJson(
        res,
        404,
        'not_found',
        'Запрос подтверждения не найден. Запустите проверку снова.',
      )
    }

    if (verification.confirmed) {
      return res.status(200).json({
        success: true,
        data: { status: 'ok' },
      })
    }

    if (verification.expiresAt && new Date(verification.expiresAt).getTime() <= Date.now()) {
      await PhoneVerifications.findOneAndUpdate(
        { _id: verification._id },
        { $set: { providerStatus: 'expired' } },
      )
      return res.status(200).json({
        success: true,
        data: { status: 'expired' },
      })
    }

    const provider = await checkTelefonipReverseCall(callId)
    const providerData = provider?.data || {}
    const providerStatusRaw = resolveStatusFromProvider(providerData)

    let confirmed = false
    if (providerStatusRaw === 'ok') {
      const providerPhone = normalizeAuthPhone7(providerData?.data?.phone)
      confirmed = providerPhone !== null && providerPhone === phone
    }
    const providerStatus = confirmed ? 'ok' : providerStatusRaw

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

    return res.status(200).json({
      success: true,
      data: {
        status: providerStatus,
      },
    })
  } catch (error) {
    console.error('Phone verify check error', error)
    return errorJson(
      res,
      500,
      'unknown',
      'Не удалось проверить статус подтверждения. Попробуйте позже.',
    )
  }
}
