import { getServerSession } from 'next-auth/next'
import { authOptions } from '@pages/api/auth/[...nextauth]'
import normalizeAuthPhone from '@helpers/normalizeAuthPhone'
import resolveSessionUserFilter from '@helpers/resolveSessionUserFilter'
import dbConnectGlobal from '@utils/dbConnectGlobal'

const FLOW = 'change_phone'

const errorJson = (res, status, message) =>
  res.status(status).json({
    success: false,
    error: message,
  })

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return errorJson(res, 405, 'Метод не поддерживается')
  }

  const session = await getServerSession(req, res, authOptions)
  if (!session?.user) {
    return errorJson(res, 401, 'Необходима авторизация')
  }

  const phone = normalizeAuthPhone(req.body?.phone)
  const callId = Number(req.body?.callId)

  if (!phone) {
    return errorJson(res, 400, 'Укажите корректный номер телефона.')
  }
  if (!Number.isFinite(callId)) {
    return errorJson(res, 400, 'Некорректный идентификатор звонка.')
  }

  const userFilter = resolveSessionUserFilter(session.user)
  if (!userFilter) {
    return errorJson(res, 400, 'Не удалось определить пользователя.')
  }

  try {
    const globalDb = await dbConnectGlobal()
    if (!globalDb) {
      return errorJson(res, 503, 'Глобальная база пользователей недоступна')
    }

    const Users = globalDb.model('Users')
    const PhoneVerifications = globalDb.model('PhoneVerifications')

    const currentUser = await Users.findOne(userFilter).select({ _id: 1, phone: 1 }).lean()
    if (!currentUser?._id) {
      return errorJson(res, 404, 'Пользователь не найден.')
    }

    if (Number(currentUser.phone) === phone) {
      await PhoneVerifications.deleteMany({ phone, flow: FLOW })
      return res.status(200).json({
        success: true,
        data: currentUser,
      })
    }

    const verification = await PhoneVerifications.findOne({ phone, flow: FLOW }).lean()
    if (!verification || Number(verification.callId) !== callId || !verification.confirmed) {
      return errorJson(
        res,
        400,
        'Номер телефона не подтвержден. Сначала завершите проверку звонком.',
      )
    }

    if (verification.expiresAt && new Date(verification.expiresAt).getTime() <= Date.now()) {
      return errorJson(res, 400, 'Время подтверждения истекло. Запросите звонок повторно.')
    }

    const existingUserWithPhone = await Users.findOne({ phone }).select({ _id: 1 }).lean()
    if (
      existingUserWithPhone?._id &&
      String(existingUserWithPhone._id) !== String(currentUser._id)
    ) {
      return errorJson(res, 400, 'Такой номер уже зарегистрирован в другом профиле.')
    }

    const updatedUser = await Users.findByIdAndUpdate(
      currentUser._id,
      {
        $set: {
          phone,
        },
      },
      { new: true },
    ).lean()

    await PhoneVerifications.deleteMany({ phone, flow: FLOW })

    return res.status(200).json({
      success: true,
      data: updatedUser,
    })
  } catch (error) {
    console.error('Failed to change user phone', error)
    return errorJson(
      res,
      500,
      'Не удалось обновить номер телефона. Попробуйте позже.',
    )
  }
}
