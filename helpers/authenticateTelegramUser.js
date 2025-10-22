import dbConnect from '@utils/dbConnect'
import getTelegramTokenByLocation from '@utils/telegram/getTelegramTokenByLocation'
import verifyTelegramAuthPayload from '@helpers/verifyTelegramAuthPayload'

const parseBooleanFlag = (value) => {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value === 1
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()

    if (!normalized) return false

    return ['1', 'true', 'yes', 'on'].includes(normalized)
  }

  return false
}

const isExplicitTestAuthEnabled =
  parseBooleanFlag(process.env.ENABLE_TEST_AUTH) ||
  parseBooleanFlag(process.env.NEXT_PUBLIC_ENABLE_TEST_AUTH)

const buildUserName = (payload) => {
  const parts = [payload?.first_name, payload?.last_name]
    .filter(Boolean)
    .map((value) => value.trim())
    .filter(Boolean)

  if (parts.length > 0) return parts.join(' ')
  if (payload?.username) return payload.username
  return 'Пользователь Telegram'
}

const normalizeTelegramId = (value) => {
  if (value === null || typeof value === 'undefined') {
    return null
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()

    if (!trimmed) {
      return null
    }

    const parsed = Number(trimmed)

    if (Number.isFinite(parsed)) {
      return parsed
    }

    return null
  }

  return null
}

const errorResponse = (code, message, details = null) => ({
  success: false,
  errorCode: code,
  errorMessage: message,
  details,
})

const authenticateTelegramUser = async ({ location, rawData }) => {
  if (!rawData) {
    return errorResponse('MISSING_PAYLOAD', 'Не получены данные авторизации Telegram.')
  }

  let payload = rawData

  try {
    if (typeof rawData === 'string') {
      payload = JSON.parse(rawData)
    }
  } catch (error) {
    return errorResponse('INVALID_PAYLOAD', 'Не удалось разобрать данные авторизации Telegram.', {
      message: error.message,
    })
  }

  if (!payload || typeof payload !== 'object') {
    return errorResponse('INVALID_PAYLOAD_TYPE', 'Некорректный формат данных авторизации Telegram.')
  }

  const currentMode =
    process.env.MODE ?? process.env.NODE_ENV ?? 'production'

  const isTestAuthAllowed =
    currentMode !== 'production' || isExplicitTestAuthEnabled

  const isTestAuth = Boolean(payload?.__isTestAuth) && isTestAuthAllowed

  const resolveLocation = () => {
    if (location) {
      return String(location)
    }

    if (payload?.__testLocation) {
      return String(payload.__testLocation)
    }

    return null
  }

  const resolvedLocation = resolveLocation()

  if (!resolvedLocation && !isTestAuth) {
    return errorResponse('MISSING_LOCATION', 'Не указан игровой регион для авторизации Telegram.')
  }

  if (isTestAuth) {
    const sanitizedPayload = { ...payload }
    delete sanitizedPayload.__isTestAuth
    if (sanitizedPayload.__testLocation) {
      delete sanitizedPayload.__testLocation
    }

    const userLocation = resolvedLocation || 'test'
    const rawPayloadTelegramId =
      sanitizedPayload?.id ?? sanitizedPayload?.telegramId ?? null
    const normalizedTelegramId = normalizeTelegramId(rawPayloadTelegramId)

    let dbUser = null

    if (resolvedLocation && normalizedTelegramId !== null) {
      try {
        const db = await dbConnect(resolvedLocation)
        if (db) {
          dbUser = await db
            .model('Users')
            .findOne({ telegramId: normalizedTelegramId })
            .lean()
        }
      } catch (lookupError) {
        console.error('Test auth user lookup error', lookupError)
      }
    }

    const fallbackTelegramId = dbUser?.telegramId ?? normalizedTelegramId ?? null

    const fallbackUserId = dbUser?._id
      ? dbUser._id.toString()
      : `test-${String(rawPayloadTelegramId ?? fallbackTelegramId ?? 'user')}`

    const resultUser = {
      id: fallbackUserId,
      telegramId:
        fallbackTelegramId !== null
          ? fallbackTelegramId
          : normalizeTelegramId(rawPayloadTelegramId),
      location: userLocation,
      name: dbUser?.name ?? buildUserName(sanitizedPayload),
      username: dbUser?.username ?? sanitizedPayload?.username ?? null,
      photoUrl: dbUser?.photoUrl ?? sanitizedPayload?.photo_url ?? null,
      languageCode: dbUser?.languageCode ?? sanitizedPayload?.language_code ?? null,
      isPremium:
        typeof dbUser?.isPremium === 'boolean'
          ? dbUser.isPremium
          : Boolean(sanitizedPayload?.is_premium),
      isTestAuth: true,
    }

    if (dbUser?.role) {
      resultUser.role = dbUser.role
    }

    return {
      success: true,
      isTestAuth: true,
      user: resultUser,
      payload: sanitizedPayload,
    }
  }

  if (!resolvedLocation) {
    return errorResponse('MISSING_LOCATION', 'Не указан игровой регион для авторизации Telegram.')
  }

  const token = getTelegramTokenByLocation(resolvedLocation)

  if (!token) {
    return errorResponse('MISSING_TELEGRAM_TOKEN', 'Для выбранного региона не настроен бот Telegram.')
  }

  const isPayloadValid = verifyTelegramAuthPayload(payload, token)

  if (!isPayloadValid) {
    return errorResponse(
      'INVALID_SIGNATURE',
      'Подпись данных авторизации Telegram не прошла проверку. Попробуйте обновить страницу и выполнить вход заново.'
    )
  }

  const db = await dbConnect(resolvedLocation)

  if (!db) {
    return errorResponse(
      'DB_CONNECTION_FAILED',
      'Не удалось подключиться к базе данных выбранного региона. Попробуйте позже или обратитесь к администратору.'
    )
  }

  const name = buildUserName(payload)
  const updates = {
    name,
    username: payload?.username ?? null,
    photoUrl: payload?.photo_url ?? null,
    languageCode: payload?.language_code ?? null,
    isPremium: Boolean(payload?.is_premium),
  }

  try {
    const user = await db
      .model('Users')
      .findOneAndUpdate(
        { telegramId: payload.id },
        { $set: updates },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        }
      )
      .lean()

    if (!user) {
      return errorResponse('USER_NOT_CREATED', 'Не удалось создать или обновить профиль пользователя Telegram.')
    }

    return {
      success: true,
      user: {
        id: user._id.toString(),
        telegramId: user.telegramId,
        location: resolvedLocation,
        name: user.name,
        username: user.username,
        photoUrl: user.photoUrl,
        languageCode: user.languageCode,
        isPremium: user.isPremium,
      },
      payload,
    }
  } catch (error) {
    return errorResponse('USER_UPDATE_FAILED', 'Ошибка при сохранении профиля пользователя Telegram.', {
      message: error.message,
    })
  }
}

export default authenticateTelegramUser
