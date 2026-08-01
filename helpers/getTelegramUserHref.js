const normalizeValue = (value) => String(value ?? '').trim()

const getTelegramUsername = (value) => {
  let normalized = normalizeValue(value)
  if (!normalized) {
    return ''
  }

  normalized = normalized
    .replace(/^tg:\/\/resolve\?domain=/i, '')
    .replace(/^https?:\/\/(?:www\.)?(?:t\.me|telegram\.me)\//i, '')
    .replace(/^@+/, '')
    .split(/[/?#&\s]/)[0]

  return normalized.trim()
}

const getTelegramPhone = (value) => {
  const normalized = normalizeValue(value)
    .replace(/^tg:\/\/resolve\?phone=/i, '')
    .replace(/^https?:\/\/(?:www\.)?(?:t\.me|telegram\.me)\/\+/i, '')

  return normalized.replace(/\D/g, '')
}

const looksLikePhone = (value) => {
  const normalized = normalizeValue(value)
    .replace(/^tg:\/\/resolve\?phone=/i, '')
    .replace(/^https?:\/\/(?:www\.)?(?:t\.me|telegram\.me)\/\+/i, '')

  return /^[+\d\s().-]+$/.test(normalized) && getTelegramPhone(normalized).length >= 7
}

const getTelegramUserHref = (value, { type = 'auto' } = {}) => {
  const normalized = normalizeValue(value)
  if (!normalized) {
    return ''
  }

  if (/^tg:\/\//i.test(normalized)) {
    return normalized
  }

  const resolveByPhone =
    type === 'phone' ||
    (type === 'auto' &&
      (/^https?:\/\/(?:www\.)?(?:t\.me|telegram\.me)\/\+/i.test(
        normalized,
      ) ||
        looksLikePhone(normalized)))

  if (resolveByPhone) {
    const phone = getTelegramPhone(normalized)
    return phone ? `tg://resolve?phone=${phone}` : ''
  }

  const username = getTelegramUsername(normalized)
  return username ? `tg://resolve?domain=${username}` : ''
}

export default getTelegramUserHref
