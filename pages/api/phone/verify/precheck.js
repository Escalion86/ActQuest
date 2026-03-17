import dbConnectGlobal from '@utils/dbConnectGlobal'
import normalizeAuthPhone from '@helpers/normalizeAuthPhone'
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

    const existingUser = await globalDb
      .model('Users')
      .findOne({ phone })
      .select({ _id: 1, passwordHash: 1 })
      .lean()

    if (flow === 'register' && existingUser?.passwordHash) {
      return res.status(200).json({
        success: true,
        data: {
          allowed: false,
          reason: 'already_registered',
          message:
            'Такой номер уже зарегистрирован. Войдите по номеру телефона или через VK.',
        },
      })
    }

    if (flow === 'recovery' && !existingUser) {
      return res.status(200).json({
        success: true,
        data: {
          allowed: false,
          reason: 'not_found',
          message: 'Аккаунт с таким номером не найден.',
        },
      })
    }

    return res.status(200).json({
      success: true,
      data: {
        allowed: true,
        reason: null,
        message: null,
      },
    })
  } catch (error) {
    console.error('Phone precheck error', error)
    return errorJson(
      res,
      500,
      'unknown',
      'Не удалось проверить номер телефона. Попробуйте позже.',
    )
  }
}
