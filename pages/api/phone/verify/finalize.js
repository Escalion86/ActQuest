import dbConnectGlobal from '@utils/dbConnectGlobal'
import normalizeAuthPhone from '@helpers/normalizeAuthPhone'
import registerPhoneUser from '@helpers/registerPhoneUser'
import { getSiteAccessControlsByLocation } from '@helpers/siteAccessControls'
import { createPasswordHash, validatePassword } from '@helpers/passwordHash'

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
  if (!['register', 'recovery'].includes(flow)) {
    return errorJson(res, 400, 'flow', 'Некорректный тип операции.')
  }
  if (!validatePassword(password)) {
    return errorJson(res, 400, 'phone', 'Пароль должен содержать минимум 8 символов.')
  }

  try {
    const controls = await getSiteAccessControlsByLocation(location)
    const isFlowAllowed =
      flow === 'register'
        ? controls.allowSiteRegistration
        : controls.allowSiteAuth

    if (!isFlowAllowed) {
      return errorJson(
        res,
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

    if (flow === 'register') {
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
      { new: true },
    ).lean()

    if (!updatedUser) {
      return errorJson(res, 404, 'not_found', 'Аккаунт с таким номером не найден.')
    }

    await PhoneVerifications.deleteMany({ phone, flow })

    return res.status(200).json({
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
    })
  } catch (error) {
    console.error('Phone verify finalize error', error)
    return errorJson(
      res,
      500,
      'unknown',
      flow === 'register'
        ? 'Не удалось завершить регистрацию. Попробуйте позже.'
        : 'Не удалось восстановить пароль. Попробуйте позже.',
    )
  }
}
