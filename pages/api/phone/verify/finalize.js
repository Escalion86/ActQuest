import dbConnectGlobal from '@utils/dbConnectGlobal'
import normalizeAuthPhone from '@helpers/normalizeAuthPhone'
import registerPhoneUser from '@helpers/registerPhoneUser'
import { getSiteAccessControlsByLocation } from '@helpers/siteAccessControls'

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
  const password = typeof req.body?.password === 'string' ? req.body.password : ''
  const flow = String(req.body?.flow || 'register').trim().toLowerCase()
  const location =
    typeof req.body?.location === 'string'
      ? req.body.location.trim().toLowerCase()
      : null

  if (!phone) {
    return errorJson(res, 400, 'phone', 'Укажите корректный номер телефона.')
  }
  if (!password) {
    return errorJson(res, 400, 'phone', 'Укажите пароль.')
  }
  if (flow !== 'register') {
    return errorJson(res, 400, 'flow', 'Пока поддерживается только flow=register.')
  }

  try {
    const controls = await getSiteAccessControlsByLocation(location)
    if (!controls.allowSiteRegistration) {
      return errorJson(
        res,
        403,
        'forbidden',
        'Регистрация на сайте временно отключена для выбранного региона.',
      )
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

    const PhoneVerifications = globalDb.model('PhoneVerifications')
    const verification = await PhoneVerifications.findOne({ phone, flow }).lean()

    if (!verification || !verification.confirmed) {
      return errorJson(
        res,
        400,
        'phone',
        'Номер телефона не подтвержден. Сначала завершите проверку звонком.',
      )
    }

    const registerResult = await registerPhoneUser({
      location,
      rawData: JSON.stringify({
        phone,
        password,
      }),
    })

    if (!registerResult.success) {
      return errorJson(
        res,
        400,
        'phone',
        registerResult.errorMessage || 'Не удалось завершить регистрацию.',
      )
    }

    await PhoneVerifications.deleteMany({ phone, flow })

    return res.status(200).json({
      success: true,
      user: registerResult.user,
    })
  } catch (error) {
    console.error('Phone verify finalize error', error)
    return errorJson(
      res,
      500,
      'unknown',
      'Не удалось завершить регистрацию. Попробуйте позже.',
    )
  }
}
