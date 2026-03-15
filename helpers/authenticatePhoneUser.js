import dbConnect from '@utils/dbConnect'

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

const normalizePhone = (value) => {
  if (value === null || typeof value === 'undefined') return null

  const raw = String(value).trim()
  if (!raw) return null

  const digits = raw.replace(/\D/g, '')
  if (!digits) return null

  const asNumber = Number(digits)
  return Number.isFinite(asNumber) ? asNumber : null
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

  const phone = normalizePhone(payload.phone)
  if (phone === null) {
    return errorResponse('INVALID_PHONE', 'Укажите корректный номер телефона.')
  }

  const providedName = normalizeName(payload.name)

  const db = await dbConnect(resolvedLocation)
  if (!db) {
    return errorResponse(
      'DB_CONNECTION_FAILED',
      'Не удалось подключиться к базе данных выбранного региона. Попробуйте позже.',
    )
  }

  try {
    const existingUser = await db.model('Users').findOne({ phone }).lean()
    const fallbackName = existingUser?.name?.trim()?.length
      ? existingUser.name
      : `Пользователь ${String(phone)}`

    const updates = {
      phone,
      name: providedName || fallbackName,
      authMethod: 'phone',
    }

    const user = await db
      .model('Users')
      .findOneAndUpdate(
        { phone },
        {
          $set: updates,
          $setOnInsert: { location: null, role: 'client', telegramId: null, vkId: null },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
      .lean()

    if (!user) {
      return errorResponse(
        'USER_NOT_CREATED',
        'Не удалось создать или обновить профиль пользователя по номеру телефона.',
      )
    }

    return {
      success: true,
      user: {
        id: user._id.toString(),
        telegramId: user.telegramId,
        vkId: user.vkId,
        phone: user.phone,
        location: resolvedLocation,
        name: user.name,
        username: user.username,
        photoUrl: user.photoUrl,
        languageCode: user.languageCode,
        isPremium: user.isPremium,
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
