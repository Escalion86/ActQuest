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

const authenticateVkUser = async ({ location, rawData }) => {
  if (!rawData) {
    return errorResponse(
      'MISSING_PAYLOAD',
      'Не получены данные авторизации VK.',
    )
  }

  let payload = rawData
  try {
    if (typeof rawData === 'string') {
      payload = JSON.parse(rawData)
    }
  } catch (error) {
    return errorResponse(
      'INVALID_PAYLOAD',
      'Не удалось разобрать данные авторизации VK.',
      {
        message: error.message,
      },
    )
  }

  if (!payload || typeof payload !== 'object') {
    return errorResponse(
      'INVALID_PAYLOAD_TYPE',
      'Некорректный формат данных авторизации VK.',
    )
  }

  const resolvedLocation = normalizeLocation(location)
  if (!resolvedLocation) {
    return errorResponse(
      'MISSING_LOCATION',
      'Не указан игровой регион для авторизации VK.',
    )
  }

  const accessToken = payload.accessToken || payload.access_token
  const vkId = payload.vkId || payload.userId || payload.user?.id
  const firstName =
    payload.firstName || payload.first_name || payload.user?.first_name
  const lastName =
    payload.lastName || payload.last_name || payload.user?.last_name
  const photoUrl = payload.photoUrl || payload.photo_url || payload.user?.photo

  if (!accessToken || !vkId) {
    return errorResponse(
      'INVALID_VK_DATA',
      'Отсутствуют необходимые данные VK авторизации (access token или user id).',
    )
  }

  const vkUserId = Number(vkId)
  if (!Number.isFinite(vkUserId)) {
    return errorResponse(
      'INVALID_VK_ID',
      'Некорректный идентификатор пользователя VK.',
    )
  }

  let verifiedUser = null
  try {
    const vkResponse = await fetch(
      `https://api.vk.com/method/users.get?user_ids=${vkUserId}&fields=photo_200&access_token=${encodeURIComponent(
        accessToken,
      )}&v=5.131`,
    )
    const vkJson = await vkResponse.json()

    if (vkJson.error) {
      return errorResponse(
        'VK_API_ERROR',
        'Ошибка VK API при проверке токена.',
        {
          vkError: vkJson.error,
        },
      )
    }

    if (
      !vkJson.response ||
      !Array.isArray(vkJson.response) ||
      vkJson.response.length === 0
    ) {
      return errorResponse('VK_USER_NOT_FOUND', 'Пользователь VK не найден.')
    }

    verifiedUser = vkJson.response[0]
  } catch (error) {
    return errorResponse(
      'VK_API_REQUEST_FAILED',
      'Не удалось проверить токен VK.',
      {
        message: error.message,
      },
    )
  }

  const nameParts = [
    firstName || verifiedUser.first_name,
    lastName || verifiedUser.last_name,
  ]
    .filter(Boolean)
    .map((x) => String(x).trim())
  const name = nameParts.length > 0 ? nameParts.join(' ') : 'Пользователь VK'

  const resolvedPhotoUrl = photoUrl || verifiedUser.photo_200 || null

  const db = await dbConnect(resolvedLocation)
  if (!db) {
    return errorResponse(
      'DB_CONNECTION_FAILED',
      'Не удалось подключиться к базе данных выбранного региона. Попробуйте позже.',
    )
  }

  try {
    const updates = {
      vkId: vkUserId,
      name,
      photoUrl: resolvedPhotoUrl,
      languageCode: null,
      isPremium: false,
      authMethod: 'vk',
    }

    const user = await db
      .model('Users')
      .findOneAndUpdate(
        { vkId: vkUserId },
        {
          $set: updates,
          $setOnInsert: { location: null, role: 'client', telegramId: null },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
      .lean()

    if (!user) {
      return errorResponse(
        'USER_NOT_CREATED',
        'Не удалось создать или обновить профиль пользователя VK.',
      )
    }

    return {
      success: true,
      user: {
        id: user._id.toString(),
        vkId: user.vkId,
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
    return errorResponse(
      'USER_UPDATE_FAILED',
      'Ошибка при сохранении профиля пользователя VK.',
      {
        message: error.message,
      },
    )
  }
}

export default authenticateVkUser
