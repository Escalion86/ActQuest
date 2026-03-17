const VK_ID_DOMAIN_DEFAULT = 'id.vk.ru'
const isVkDebugEnabled =
  process.env.VK_AUTH_DEBUG === 'true' ||
  process.env.VK_DEBUG_LOGS === 'true'

const redactValue = (key, value) => {
  const lowered = String(key || '').toLowerCase()
  if (
    lowered.includes('token') ||
    lowered.includes('secret') ||
    lowered === 'code' ||
    lowered.includes('verifier')
  ) {
    return value ? '[redacted]' : value
  }
  return value
}

const redactObject = (source = {}) =>
  Object.fromEntries(
    Object.entries(source).map(([key, value]) => [key, redactValue(key, value)]),
  )

const logVkDebug = (label, payload) => {
  if (!isVkDebugEnabled) return
  console.info(`[VK_DEBUG][vkIdAuth] ${label}`, payload)
}

const getVkClientId = () => {
  const raw =
    process.env.VK_ID_APP_ID ||
    process.env.VKID_ONETAP_APP_ID ||
    process.env.VK_APP_ID ||
    process.env.NEXT_PUBLIC_VK_ID_APP_ID ||
    process.env.NEXT_PUBLIC_VKID_ONETAP_APP_ID ||
    process.env.NEXT_PUBLIC_VK_APP_ID
  const parsed = Number.parseInt(String(raw || ''), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

const getVkClientSecret = () => {
  const raw = String(process.env.VK_ID_CLIENT_SECRET || '').trim()
  return raw || null
}

const getVkDomain = () => String(process.env.VK_ID_DOMAIN || VK_ID_DOMAIN_DEFAULT).trim()

const normalizeUrlString = (value) => {
  const raw = String(value || '').trim()
  if (!raw) return ''
  const noQuotes = raw.replace(/^['"]|['"]$/g, '').trim()
  try {
    return new URL(noQuotes).toString()
  } catch {
    return ''
  }
}

const getVkRedirectUrl = () =>
  normalizeUrlString(process.env.VK_ID_REDIRECT_URI) ||
  normalizeUrlString(process.env.NEXT_PUBLIC_VK_ID_REDIRECT_URI) ||
  normalizeUrlString(
    process.env.DOMAIN ? `${process.env.DOMAIN}/api/vk-id/callback` : '',
  )

const toFormBody = (data = {}) => {
  const form = new URLSearchParams()
  Object.entries(data).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') return
    form.append(key, String(value))
  })
  return form
}

const safeJson = async (response) => {
  try {
    return await response.json()
  } catch {
    return null
  }
}

const vkOAuthRequest = async ({
  path,
  query = {},
  body = {},
  method = 'POST',
}) => {
  const clientId = getVkClientId()
  const clientSecret = getVkClientSecret()
  if (!clientId) {
    return {
      success: false,
      data: {
        error: {
          type: 'VK_CONFIG_ERROR',
          message: 'VK app id is not configured',
        },
      },
    }
  }

  const domain = getVkDomain()
  const queryParams = new URLSearchParams({
    client_id: String(clientId),
    ...Object.fromEntries(
      Object.entries(query || {}).filter(([, value]) => value !== undefined),
    ),
  })

  const requestBody = {
    ...body,
    ...(clientSecret ? { client_secret: clientSecret } : {}),
  }

  const url = `https://${domain}${path}?${queryParams.toString()}`
  logVkDebug('oauth_request', {
    path,
    method,
    query: redactObject(
      Object.fromEntries(
        Object.entries(query || {}).filter(([, value]) => value !== undefined),
      ),
    ),
    body: redactObject(requestBody),
    hasClientSecret: Boolean(clientSecret),
  })

  const response = await fetch(url, {
    method,
    body: toFormBody(requestBody),
  })
  const data = await safeJson(response)
  logVkDebug('oauth_response', {
    path,
    method,
    httpStatus: response.status,
    ok: response.ok,
    hasJson: Boolean(data),
    vkError: data?.error || data?.error_description || null,
    keys: data && typeof data === 'object' ? Object.keys(data).sort() : [],
  })

  if (!response.ok) {
    return {
      success: false,
      data: {
        error: {
          type: 'VK_HTTP_ERROR',
          message: 'VK service returned an error response',
        },
        vk: data,
      },
    }
  }

  if (!data || data.error) {
    return {
      success: false,
      data: {
        error: {
          type: 'VK_API_ERROR',
          message: data?.error_description || data?.error || 'VK API error',
        },
        vk: data,
      },
    }
  }

  return {
    success: true,
    data,
  }
}

const exchangeVkCode = async ({ code, deviceId, codeVerifier, state }) => {
  logVkDebug('exchange_code_start', {
    hasCode: Boolean(code),
    hasDeviceId: Boolean(deviceId),
    hasCodeVerifier: Boolean(codeVerifier),
    hasState: Boolean(state),
  })
  const redirectUri = getVkRedirectUrl()
  if (!redirectUri) {
    return {
      success: false,
      data: {
        error: {
          type: 'VK_CONFIG_ERROR',
          message: 'VK redirect URI is not configured',
        },
      },
    }
  }

  return vkOAuthRequest({
    path: '/oauth2/auth',
    query: {
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      device_id: deviceId,
      state: state || 'vkid_state',
      code_verifier: codeVerifier,
    },
    body: { code },
  })
}

const fetchVkUserInfo = async ({ accessToken }) =>
  vkOAuthRequest({
    path: '/oauth2/user_info',
    body: {
      access_token: accessToken,
    },
  })

export { exchangeVkCode, fetchVkUserInfo }
