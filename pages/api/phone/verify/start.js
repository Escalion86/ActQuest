import dbConnectGlobal from '@utils/dbConnectGlobal'
import normalizeAuthPhone from '@helpers/normalizeAuthPhone'
import { getSiteAccessControlsByLocation } from '@helpers/siteAccessControls'
import { startTelefonipReverseCall } from '@helpers/telefonipAuthCalls'

const START_RATE_LIMIT_MS = 60 * 1000
const VERIFY_TTL_MS = 15 * 60 * 1000

const errorJson = (res, status, type, message) =>
  res.status(status).json({
    success: false,
    error: {
      type,
      message,
    },
  })

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return errorJson(res, 405, 'method', 'Метод не поддерживается')
  }

  const phone = normalizeAuthPhone(req.body?.phone)
  const flow = String(req.body?.flow || 'register').trim().toLowerCase()
  const location =
    typeof req.body?.location === 'string'
      ? req.body.location.trim().toLowerCase()
      : null

  if (!phone) {
    return errorJson(res, 400, 'phone', 'Укажите корректный номер телефона.')
  }
  if (!['register', 'recovery'].includes(flow)) {
    return errorJson(res, 400, 'flow', 'Некорректный тип операции.')
  }

  try {
    if (flow === 'register') {
      const controls = await getSiteAccessControlsByLocation(location)
      if (!controls.allowSiteRegistration) {
        return errorJson(
          res,
          403,
          'forbidden',
          'Регистрация на сайте временно отключена для выбранного региона.',
        )
      }
    }

    const globalDb = await dbConnectGlobal()
    if (!globalDb) {
      return errorJson(
        res,
        503,
        'unknown',
        'Не удалось подключиться к базе. Попробуйте позже.',
      )
    }

    const Users = globalDb.model('Users')
    const PhoneVerifications = globalDb.model('PhoneVerifications')

    const existingUser = await Users.findOne({ phone }).select({ _id: 1, passwordHash: 1 }).lean()

    if (flow === 'register' && existingUser?.passwordHash) {
      return errorJson(
        res,
        400,
        'phone',
        'Такой номер уже зарегистрирован. Войдите по номеру телефона или через VK.',
      )
    }

    if (flow === 'recovery' && !existingUser) {
      return errorJson(
        res,
        404,
        'not_found',
        'Аккаунт с таким номером не найден.',
      )
    }

    const latest = await PhoneVerifications.findOne({ phone, flow })
      .sort({ updatedAt: -1 })
      .lean()

    if (latest?.updatedAt) {
      const diffMs = Date.now() - new Date(latest.updatedAt).getTime()
      if (diffMs < START_RATE_LIMIT_MS) {
        return errorJson(
          res,
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
        res,
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

    return res.status(200).json({
      success: true,
      data: {
        id: callId,
        auth_phone: authPhone,
        url_image: imageUrl,
        expiresAt: expiresAt.toISOString(),
      },
    })
  } catch (error) {
    console.error('Phone verify start error', error)
    return errorJson(
      res,
      500,
      'unknown',
      'Не удалось запустить проверку телефона. Попробуйте позже.',
    )
  }
}
