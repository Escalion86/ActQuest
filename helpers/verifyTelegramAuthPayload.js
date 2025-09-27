import crypto from 'crypto'

const TELEGRAM_AUTH_TTL = 86400 // 24 hours

const buildCheckString = (payload) =>
  Object.keys(payload)
    .sort()
    .map((key) => `${key}=${payload[key]}`)
    .join('\n')

const verifyTelegramAuthPayload = (payload, botToken) => {
  if (!payload || typeof payload !== 'object') return false
  if (!botToken) return false

  const { hash, auth_date: authDate, ...rest } = payload

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
