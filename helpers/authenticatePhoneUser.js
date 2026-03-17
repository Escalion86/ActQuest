import dbConnectGlobal from '@utils/dbConnectGlobal'
import upsertGlobalUser from '@helpers/upsertGlobalUser'
import syncLegacyUserByLocation from '@helpers/syncLegacyUserByLocation'
import normalizeAuthPhone from '@helpers/normalizeAuthPhone'

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

const authenticatePhoneUser = async ({ location, rawData }) => {
  if (!rawData) {
    return errorResponse('MISSING_PAYLOAD', 'Не получены данные авторизации по номеру телефона.')
  }

  let payload = rawData
  try {
    if (typeof rawData === 'string') {
      payload = JSON.parse(rawData)
    }
  } catch (error) {
    return errorResponse(
      'INVALID_PAYLOAD',
      'Не удалось разобрать данные авторизации по номеру телефона.',
      { message: error.message },
    )
  }

  if (!payload || typeof payload !== 'object') {
    return errorResponse(
      'INVALID_PAYLOAD_TYPE',
      'Некорректный формат данных авторизации по номеру телефона.',
    )
  }

  const resolvedLocation = normalizeLocation(location)
  if (!resolvedLocation) {
    return errorResponse('MISSING_LOCATION', 'Не указан игровой регион для авторизации.')
  }

  const phone = normalizeAuthPhone(payload.phone)
  if (phone === null) {
    return errorResponse('INVALID_PHONE', 'Укажите корректный номер телефона.')
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
    const fallbackName = existingUser?.name?.trim()?.length
      ? existingUser.name
      : `Пользователь ${String(phone)}`

    const updates = {
      phone,
      name: providedName || fallbackName,
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
        'Не удалось создать или обновить профиль пользователя по номеру телефона.',
      )
    }

    await syncLegacyUserByLocation({
      location: resolvedLocation,
      findQuery: { phone },
      updates: {
        ...updates,
        authMethod: 'phone',
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
      payload,
    }
  } catch (error) {
    return errorResponse(
      'USER_UPDATE_FAILED',
      'Ошибка при сохранении профиля пользователя по номеру телефона.',
      { message: error.message },
    )
  }
}

export default authenticatePhoneUser
