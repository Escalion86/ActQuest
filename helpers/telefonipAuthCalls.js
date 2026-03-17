const TELEFONIP_BASE_URL = 'https://api.telefon-ip.ru/api/v1/authcalls'

const normalizeTelefonipPhone = (phoneValue) => {
  const digits = String(phoneValue ?? '').replace(/\D/g, '')
  if (!digits) return null

  if (digits.length === 11 && digits.startsWith('8')) return digits
  if (digits.length === 11 && digits.startsWith('7')) return `8${digits.slice(1)}`
  if (digits.length === 10) return `8${digits}`

  return null
}

const normalizeAuthPhone7 = (phoneValue) => {
  const digits = String(phoneValue ?? '').replace(/\D/g, '')
  if (!digits) return null

  if (digits.length === 11 && digits.startsWith('7')) return Number(digits)
  if (digits.length === 11 && digits.startsWith('8')) return Number(`7${digits.slice(1)}`)
  if (digits.length === 10) return Number(`7${digits}`)

  return null
}

const getTelefonipToken = () => {
  const token = String(process.env.TELEFONIP || '').trim()
  return token || null
}

const safeJson = async (response) => {
  try {
    return await response.json()
  } catch {
    return null
  }
}

const telefonipRequest = async (path) => {
  const token = getTelefonipToken()
  if (!token) {
    return {
      success: false,
      data: {
        success: false,
        error: {
          type: 'config',
          message: 'TELEFONIP token is not configured',
        },
      },
    }
  }

  const response = await fetch(`${TELEFONIP_BASE_URL}/${token}${path}`, {
    method: 'GET',
  })
  const data = await safeJson(response)

  return {
    success: response.ok,
    data,
  }
}

const startTelefonipReverseCall = async (phone) => {
  const phone8 = normalizeTelefonipPhone(phone)
  if (!phone8) {
    return {
      success: false,
      data: {
        success: false,
        error: {
          type: 'phone',
          message: 'Invalid phone format for TELEFONIP',
        },
      },
    }
  }

  return telefonipRequest(
    `/reverse_auth_phone_get?phone=${encodeURIComponent(phone8)}`,
  )
}

const checkTelefonipReverseCall = async (callId) =>
  telefonipRequest(`/reverse_auth_phone_check/${encodeURIComponent(String(callId))}`)

export {
  normalizeTelefonipPhone,
  normalizeAuthPhone7,
  startTelefonipReverseCall,
  checkTelefonipReverseCall,
}
