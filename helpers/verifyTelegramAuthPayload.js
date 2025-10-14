import crypto from 'crypto'

const TELEGRAM_AUTH_TTL = 86400 // 24 hours

const serializeValue = (value) => {
  if (value === null || typeof value === 'undefined') return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  if (typeof value === 'object') {
    try {
      return JSON.stringify(value)
    } catch (error) {
      return ''
    }
  }

  return ''
}

const buildCheckString = (payload) =>
  Object.keys(payload)
    .sort()
    .map((key) => `${key}=${serializeValue(payload[key])}`)
    .join('\n')

const verifyTelegramAuthPayload = (payload, botToken) => {
  if (!payload || typeof payload !== 'object') return false
  if (!botToken) return false

  const { hash, ...rest } = payload

  const authDate = payload?.auth_date

  if (!hash || !authDate) return false

  const authDateNum = Number(authDate)
  if (!Number.isFinite(authDateNum)) return false

  const now = Math.floor(Date.now() / 1000)
  if (Math.abs(now - authDateNum) > TELEGRAM_AUTH_TTL) return false

  const secretKey = crypto
    .createHash('sha256')
    .update(botToken)
    .digest()

  const checkString = buildCheckString(rest)

  const calculatedHash = crypto
    .createHmac('sha256', secretKey)
    .update(checkString)
    .digest('hex')

  return calculatedHash === hash
}

export default verifyTelegramAuthPayload
