const PROJECT_CITY_OPTIONS = [
  { key: 'krsk', title: 'Красноярск' },
  { key: 'nrsk', title: 'Норильск' },
  { key: 'ekb', title: 'Екатеринбург' },
]

const PROJECT_CITY_KEY_SET = new Set(PROJECT_CITY_OPTIONS.map(({ key }) => key))

const TELEGRAM_CHAT_URL_ENV_BY_CITY = {
  krsk: ['TELEGRAM_CHAT_URL_KRSK', 'TELEGRAM_KRSK_CHAT_URL'],
  nrsk: ['TELEGRAM_CHAT_URL_NRSK', 'TELEGRAM_NRSK_CHAT_URL'],
  ekb: ['TELEGRAM_CHAT_URL_EKB', 'TELEGRAM_EKB_CHAT_URL'],
}

const sanitizeTelegramUrl = (value) => {
  if (typeof value !== 'string') {
    return ''
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return ''
  }

  const url = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`

  return /^https:\/\/t\.me\//i.test(url) ? url : ''
}

const resolveCityFromStartPayload = (payload) => {
  if (typeof payload !== 'string') {
    return null
  }

  const normalized = payload.trim().toLowerCase()
  if (!normalized) {
    return null
  }

  if (normalized.startsWith('city_')) {
    const cityKey = normalized.slice(5)
    return PROJECT_CITY_KEY_SET.has(cityKey) ? cityKey : null
  }

  return PROJECT_CITY_KEY_SET.has(normalized) ? normalized : null
}

const parseStartPayloadFromText = (text) => {
  if (typeof text !== 'string') {
    return ''
  }

  const trimmed = text.trim()
  if (!trimmed.toLowerCase().startsWith('/start')) {
    return ''
  }

  const spaceIndex = trimmed.indexOf(' ')
  if (spaceIndex < 0) {
    return ''
  }

  return trimmed.slice(spaceIndex + 1).trim()
}

const getProjectBotBaseUrl = () => {
  const explicitUrl = sanitizeTelegramUrl(process.env.TELEGRAM_PROJECT_BOT_URL)
  if (explicitUrl) {
    return explicitUrl
  }

  const usernameRaw =
    typeof process.env.TELEGRAM_PROJECT_BOT_USERNAME === 'string'
      ? process.env.TELEGRAM_PROJECT_BOT_USERNAME.trim()
      : 'ActQuest_bot'
  if (!usernameRaw) {
    return ''
  }

  const username = usernameRaw.replace(/^@/, '')
  return username ? `https://t.me/${username}` : ''
}

const buildProjectBotCityStartLink = (cityKey) => {
  if (!PROJECT_CITY_KEY_SET.has(cityKey)) {
    return ''
  }

  const baseUrl = getProjectBotBaseUrl()
  if (!baseUrl) {
    return ''
  }

  return `${baseUrl}?start=city_${cityKey}`
}

const resolveEnvCityChatUrls = () =>
  PROJECT_CITY_OPTIONS.reduce((acc, city) => {
    const envKeys = TELEGRAM_CHAT_URL_ENV_BY_CITY[city.key] || []
    const raw = envKeys
      .map((envKey) => process.env[envKey])
      .find((value) => typeof value === 'string' && value.trim().length > 0)
    acc[city.key] = sanitizeTelegramUrl(raw)
    return acc
  }, {})

export {
  PROJECT_CITY_OPTIONS,
  PROJECT_CITY_KEY_SET,
  sanitizeTelegramUrl,
  resolveCityFromStartPayload,
  parseStartPayloadFromText,
  getProjectBotBaseUrl,
  buildProjectBotCityStartLink,
  resolveEnvCityChatUrls,
}
