import dbConnectGlobal from '@utils/dbConnectGlobal'
import syncLegacyUserByLocation from '@helpers/syncLegacyUserByLocation'
import upsertGlobalUser from '@helpers/upsertGlobalUser'
import normalizeAuthPhone from '@helpers/normalizeAuthPhone'
import { createPasswordHash, validatePassword } from '@helpers/passwordHash'
import isMongoDuplicatePhoneError from '@helpers/isMongoDuplicatePhoneError'

const errorResponse = (code, message, details = null) => ({
  success: false,
  errorCode: code,
  errorMessage: message,
  details,
})

const normalizeLocation = (location) => {
  if (!location) return null
  return String(location)
}

const normalizeName = (value) => {
  if (typeof value !== 'string') return ''
  return value.trim()
}

const registerPhoneUser = async ({ location, rawData }) => {
  if (!rawData) {
    return errorResponse('MISSING_PAYLOAD', 'Не получены данные регистрации.')
  }

  let payload = rawData
  try {
    if (typeof rawData === 'string') {
      payload = JSON.parse(rawData)
    }
  } catch (error) {
    return errorResponse(
      'INVALID_PAYLOAD',
      'Не удалось разобрать данные регистрации.',
      { message: error.message },
    )
  }

  if (!payload || typeof payload !== 'object') {
    return errorResponse(
      'INVALID_PAYLOAD_TYPE',
      'Некорректный формат данных регистрации.',
    )
  }

  const resolvedLocation = normalizeLocation(location)
  if (!resolvedLocation) {
    return errorResponse(
      'MISSING_LOCATION',
      'Не указан игровой регион для регистрации.',
    )
  }

  const phone = normalizeAuthPhone(payload.phone)
  if (phone === null) {
    return errorResponse('INVALID_PHONE', 'Укажите корректный номер телефона.')
  }

  const password = typeof payload.password === 'string' ? payload.password : ''
  if (!validatePassword(password)) {
    return errorResponse(
      'WEAK_PASSWORD',
      'Пароль должен содержать минимум 8 символов.',
    )
  }

  const providedName = normalizeName(payload.name)
  const globalDb = await dbConnectGlobal()
  if (!globalDb) {
    return errorResponse(
      'GLOBAL_DB_CONNECTION_FAILED',
      'Не удалось подключиться к глобальной базе пользователей. Попробуйте позже.',
    )
  }

  try {
    const existingUser = await globalDb.model('Users').findOne({ phone }).lean()
    if (existingUser?.passwordHash) {
      return errorResponse(
        'ACCOUNT_ALREADY_REGISTERED',
        'Аккаунт с таким номером уже зарегистрирован. Войдите по паролю или через VK.',
      )
    }

    const passwordHash = createPasswordHash(password)
    const fallbackName =
      providedName || existingUser?.name || `Пользователь ${String(phone)}`

    const updates = {
      phone,
      name: fallbackName,
      passwordHash,
      authMethod: 'phone',
      currentLocation: resolvedLocation,
    }

    const user = await upsertGlobalUser({
      phone,
      updates,
      authMethod: 'phone',
      setOnInsert: { accountLocation: resolvedLocation },
    })

    if (!user) {
      return errorResponse(
        'USER_NOT_CREATED',
        'Не удалось завершить регистрацию пользователя.',
      )
    }

    await syncLegacyUserByLocation({
      location: resolvedLocation,
      findQuery: { phone },
      globalUserId: user._id,
      updates: {
        ...updates,
        globalUserId: user._id.toString(),
      },
    })

    return {
      success: true,
      user: {
        id: user._id.toString(),
        globalUserId: user._id.toString(),
        telegramId: user.telegramId,
        vkId: user.vkId,
        phone: user.phone,
        location: resolvedLocation,
        name: user.name,
        username: user.username,
        photoUrl: user.photoUrl,
        languageCode: user.languageCode,
        isPremium: user.isPremium,
        role: user.role ?? 'client',
        authMethod: 'phone',
      },
    }
  } catch (error) {
    if (isMongoDuplicatePhoneError(error)) {
      return errorResponse(
        'ACCOUNT_ALREADY_REGISTERED',
        'Аккаунт с таким номером уже зарегистрирован. Войдите по паролю или через VK.',
      )
    }

    return errorResponse(
      'USER_UPDATE_FAILED',
      'Ошибка при регистрации пользователя.',
      {
        message: error.message,
      },
    )
  }
}

export default registerPhoneUser
