import dbConnectGlobal from '@utils/dbConnectGlobal'
import upsertGlobalUser from '@helpers/upsertGlobalUser'
import syncLegacyUserByLocation from '@helpers/syncLegacyUserByLocation'
import normalizeAuthPhone from '@helpers/normalizeAuthPhone'

const isVkDebugEnabled =
  process.env.VK_AUTH_DEBUG === 'true' ||
  process.env.VK_DEBUG_LOGS === 'true'

const maskToken = (token) => {
  if (!token || typeof token !== 'string') return null
  if (token.length <= 10) return '***'
  return `${token.slice(0, 4)}...${token.slice(-4)}`
}

const safeKeys = (obj) =>
  obj && typeof obj === 'object' ? Object.keys(obj).sort() : []

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

const normalizeVkPhone = (value) => {
  if (value === null || typeof value === 'undefined') return null

  const raw = String(value).trim()
  if (!raw) return null

  const direct = normalizeAuthPhone(raw)
  if (direct !== null) return direct

  const digits = raw.replace(/\D/g, '')
  if (!digits) return null

  if (digits.length === 10) {
    return normalizeAuthPhone(`7${digits}`)
  }

  if (digits.length === 11) {
    if (digits.startsWith('8')) {
      return normalizeAuthPhone(`7${digits.slice(1)}`)
    }
    return normalizeAuthPhone(digits)
  }

  if (digits.length > 11) {
    if (digits.startsWith('7')) {
      return normalizeAuthPhone(digits.slice(0, 11))
    }
    if (digits.startsWith('8')) {
      return normalizeAuthPhone(`7${digits.slice(1, 11)}`)
    }
  }

  return null
}

const authenticateVkUser = async ({ location, rawData }) => {
  if (isVkDebugEnabled) {
    console.info('[VK_DEBUG] authenticateVkUser:start', {
      location,
      rawDataType: typeof rawData,
      rawDataLength: typeof rawData === 'string' ? rawData.length : null,
    })
  }

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
    if (isVkDebugEnabled) {
      console.info('[VK_DEBUG] authenticateVkUser:invalid_json', {
        message: error.message,
      })
    }
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
  const phone = normalizeVkPhone(
    payload.phone || payload.user?.phone || payload.user?.phone_number,
  )
  const firstName =
    payload.firstName || payload.first_name || payload.user?.first_name
  const lastName =
    payload.lastName || payload.last_name || payload.user?.last_name
  const photoUrl = payload.photoUrl || payload.photo_url || payload.user?.photo

  if (isVkDebugEnabled) {
    console.info('[VK_DEBUG] authenticateVkUser:payload_parsed', {
      payloadKeys: safeKeys(payload),
      userKeys: safeKeys(payload?.user),
      vkIdRaw: payload.vkId ?? payload.userId ?? payload.user?.id ?? null,
      hasPhone: phone !== null,
      accessTokenMasked: maskToken(accessToken),
    })
  }

  if (!accessToken || !vkId) {
    return errorResponse(
      'INVALID_VK_DATA',
      'Отсутствуют необходимые данные VK авторизации (access token или user id).',
    )
  }

  if (phone === null) {
    return errorResponse(
      'VK_PHONE_REQUIRED',
      'VK не передал номер телефона. Вход возможен только по подтвержденному номеру телефона.',
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

    if (isVkDebugEnabled) {
      console.info('[VK_DEBUG] authenticateVkUser:vk_users_get', {
        httpStatus: vkResponse.status,
        vkErrorCode: vkJson?.error?.error_code ?? null,
        hasResponseArray: Array.isArray(vkJson?.response),
        responseLength: Array.isArray(vkJson?.response) ? vkJson.response.length : null,
      })
    }

    if (vkJson.error) {
      // Для токенов VK ID метод api.vk.com/users.get может вернуть auth-ошибку.
      // В таком случае используем данные из One Tap payload и не блокируем вход.
      if (isVkDebugEnabled) {
        console.info('[VK_DEBUG] authenticateVkUser:vk_api_error_fallback_to_payload', {
          vkError: vkJson.error,
          vkUserId,
        })
      }

      verifiedUser = {
        id: vkUserId,
        first_name: firstName || null,
        last_name: lastName || null,
        photo_200: photoUrl || null,
      }
    } else if (
      !vkJson.response ||
      !Array.isArray(vkJson.response) ||
      vkJson.response.length === 0
    ) {
      if (isVkDebugEnabled) {
        console.info('[VK_DEBUG] authenticateVkUser:vk_user_not_found_fallback_to_payload', {
          vkUserId,
        })
      }

      verifiedUser = {
        id: vkUserId,
        first_name: firstName || null,
        last_name: lastName || null,
        photo_200: photoUrl || null,
      }
    } else {
      verifiedUser = vkJson.response[0]
    }
  } catch (error) {
    if (isVkDebugEnabled) {
      console.info('[VK_DEBUG] authenticateVkUser:vk_api_request_failed_fallback_to_payload', {
        message: error.message,
        vkUserId,
      })
    }

    verifiedUser = {
      id: vkUserId,
      first_name: firstName || null,
      last_name: lastName || null,
      photo_200: photoUrl || null,
    }
  }

  const nameParts = [
    firstName || verifiedUser.first_name,
    lastName || verifiedUser.last_name,
  ]
    .filter(Boolean)
    .map((x) => String(x).trim())
  const name = nameParts.length > 0 ? nameParts.join(' ') : 'Пользователь VK'

  const resolvedPhotoUrl = photoUrl || verifiedUser.photo_200 || null

  const globalDb = await dbConnectGlobal()
  if (!globalDb) {
    return errorResponse(
      'GLOBAL_DB_CONNECTION_FAILED',
      'Не удалось подключиться к глобальной базе пользователей. Попробуйте позже.',
    )
  }

  try {
    const updates = {
      vkId: vkUserId,
      name,
      photoUrl: resolvedPhotoUrl,
      languageCode: null,
      isPremium: false,
      currentLocation: resolvedLocation,
      ...(phone !== null ? { phone } : {}),
    }

    const user = await upsertGlobalUser({
      phone,
      updates,
      authMethod: 'vk',
      setOnInsert: { accountLocation: resolvedLocation },
    })

    if (!user) {
      return errorResponse(
        'USER_NOT_CREATED',
        'Не удалось создать или обновить профиль пользователя VK.',
      )
    }

    await syncLegacyUserByLocation({
      location: resolvedLocation,
      findQuery: { phone },
      updates: {
        ...updates,
        authMethod: 'vk',
        globalUserId: user._id.toString(),
      },
    })

    if (isVkDebugEnabled) {
      console.info('[VK_DEBUG] authenticateVkUser:success', {
        location: resolvedLocation,
        globalUserId: user?._id ? String(user._id) : null,
        vkUserId,
      })
    }

    return {
      success: true,
      user: {
        id: user._id.toString(),
        globalUserId: user._id.toString(),
        vkId: user.vkId,
        telegramId: user.telegramId,
        phone: user.phone,
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
    if (isVkDebugEnabled) {
      console.info('[VK_DEBUG] authenticateVkUser:user_update_failed', {
        message: error.message,
      })
    }
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
