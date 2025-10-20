import dbConnect from '@utils/dbConnect'
import getTelegramTokenByLocation from '@utils/telegram/getTelegramTokenByLocation'
import verifyTelegramAuthPayload from '@helpers/verifyTelegramAuthPayload'

const buildUserName = (payload) => {
  const parts = [payload?.first_name, payload?.last_name]
    .filter(Boolean)
    .map((value) => value.trim())
    .filter(Boolean)

  if (parts.length > 0) return parts.join(' ')
  if (payload?.username) return payload.username
  return 'Пользователь Telegram'
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

  const isTestAuth = Boolean(payload?.__isTestAuth) && currentMode !== 'production'

  if (!location && !isTestAuth) {
    return errorResponse('MISSING_LOCATION', 'Не указан игровой регион для авторизации Telegram.')
  }

  if (isTestAuth) {
    const sanitizedPayload = { ...payload }
    delete sanitizedPayload.__isTestAuth

    const telegramId =
      sanitizedPayload?.id !== undefined && sanitizedPayload?.id !== null
        ? String(sanitizedPayload.id)
        : 'test-user'
    const userLocation = location || 'test'
    const name = buildUserName(sanitizedPayload)

    return {
      success: true,
      isTestAuth: true,
      user: {
        id: `test-${telegramId}`,
        telegramId,
        location: userLocation,
        name,
        username: sanitizedPayload?.username ?? null,
        photoUrl: sanitizedPayload?.photo_url ?? null,
        languageCode: sanitizedPayload?.language_code ?? null,
        isPremium: Boolean(sanitizedPayload?.is_premium),
        isTestAuth: true,
      },
      payload: sanitizedPayload,
    }
  }

  if (!location) {
    return errorResponse('MISSING_LOCATION', 'Не указан игровой регион для авторизации Telegram.')
  }

  const token = getTelegramTokenByLocation(location)

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

  const db = await dbConnect(location)

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
        location,
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
