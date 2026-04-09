import dbConnectGlobal from '@utils/dbConnectGlobal'
import syncLegacyUserByLocation from '@helpers/syncLegacyUserByLocation'
import normalizeAuthPhone from '@helpers/normalizeAuthPhone'
import { verifyPasswordHash } from '@helpers/passwordHash'
import { getSiteAccessControlsByLocation } from '@helpers/siteAccessControls'

const errorResponse = (code, message, details = null) => ({
  success: false,
  errorCode: code,
  errorMessage: message,
  details,
})

const normalizeLocation = (location) => {
  if (!location) return null
  return String(location).trim().toLowerCase() || null
}

const normalizePassword = (value) => {
  if (typeof value !== 'string') return ''
  return value
}

const authenticatePasswordUser = async ({ location, rawData }) => {
  if (!rawData) {
    return errorResponse('MISSING_PAYLOAD', 'Не получены данные авторизации.')
  }

  let payload = rawData
  try {
    if (typeof rawData === 'string') {
      payload = JSON.parse(rawData)
    }
  } catch (error) {
    return errorResponse(
      'INVALID_PAYLOAD',
      'Не удалось разобрать данные авторизации.',
      { message: error.message },
    )
  }

  if (!payload || typeof payload !== 'object') {
    return errorResponse(
      'INVALID_PAYLOAD_TYPE',
      'Некорректный формат данных авторизации.',
    )
  }

  const resolvedLocation = normalizeLocation(location)

  const phone = normalizeAuthPhone(payload.phone)
  if (phone === null) {
    return errorResponse('INVALID_PHONE', 'Укажите корректный номер телефона.')
  }

  const password = normalizePassword(payload.password)
  if (!password) {
    return errorResponse('INVALID_PASSWORD', 'Введите пароль.')
  }

  const globalDb = await dbConnectGlobal()
  if (!globalDb) {
    return errorResponse(
      'GLOBAL_DB_CONNECTION_FAILED',
      'Не удалось подключиться к глобальной базе пользователей. Попробуйте позже.',
    )
  }

  try {
    const user = await globalDb.model('Users').findOne({ phone }).lean()
    if (!user) {
      return errorResponse(
        'ACCOUNT_NOT_FOUND',
        'Аккаунт с таким номером не найден. Пройдите регистрацию или войдите через VK.',
      )
    }

    if (!user.passwordHash) {
      const controls = await getSiteAccessControlsByLocation(resolvedLocation)
      const vkAvailable = Boolean(
        controls?.allowSiteAuth && controls?.enableVkOneTap,
      )

      return errorResponse(
        'PASSWORD_NOT_SET',
        vkAvailable
          ? 'Для этого номера пароль не задан. Завершите регистрацию или войдите через VK.'
          : 'Для этого номера пароль не задан. Завершите регистрацию.',
      )
    }

    const isPasswordValid = verifyPasswordHash(password, user.passwordHash)
    if (!isPasswordValid) {
      return errorResponse(
        'WRONG_PASSWORD',
        'Неверный пароль. Попробуйте снова.',
      )
    }

    const persistedLocation =
      typeof user?.currentLocation === 'string' && user.currentLocation.trim()
        ? user.currentLocation.trim().toLowerCase()
        : null
    const effectiveLocation = persistedLocation || resolvedLocation || null

    const updates = {
      authMethod: 'phone',
      ...(effectiveLocation ? { currentLocation: effectiveLocation } : {}),
    }

    const refreshedUser = await globalDb
      .model('Users')
      .findByIdAndUpdate(
        user._id,
        { $set: updates },
        { returnDocument: 'after' },
      )
      .lean()

    await syncLegacyUserByLocation({
      location: effectiveLocation,
      findQuery: { phone },
      globalUserId: user._id,
      updates: {
        ...updates,
        globalUserId: user._id.toString(),
      },
    })

    const source = refreshedUser || user

    return {
      success: true,
      user: {
        id: source._id.toString(),
        globalUserId: source._id.toString(),
        telegramId: source.telegramId,
        vkId: source.vkId,
        phone: source.phone,
        location: effectiveLocation,
        name: source.name,
        username: source.username,
        photoUrl: source.photoUrl,
        languageCode: source.languageCode,
        isPremium: source.isPremium,
        role: source.role ?? 'client',
        authMethod: 'phone',
      },
      payload,
    }
  } catch (error) {
    return errorResponse(
      'USER_UPDATE_FAILED',
      'Ошибка при авторизации пользователя.',
      {
        message: error.message,
      },
    )
  }
}

export default authenticatePasswordUser
