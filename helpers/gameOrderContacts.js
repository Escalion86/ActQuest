import getTelegramUserHref from '@helpers/getTelegramUserHref'

const normalizeContactValue = (value) =>
  typeof value === 'string' ? value.trim() : ''

export const formatGameOrderPhone = (phone) => {
  const normalized = normalizeContactValue(phone)
  if (!normalized) {
    return ''
  }
  return normalized.startsWith('+') ? normalized : `+${normalized}`
}

export const getGameOrderPhoneHref = (phone) => {
  const formatted = formatGameOrderPhone(phone)
  return formatted ? `tel:${formatted.replace(/[^\d+]/g, '')}` : ''
}

export const getGameOrderTelegramHref = (telegram) => {
  const normalized = normalizeContactValue(telegram)
  if (!normalized) {
    return ''
  }
  return getTelegramUserHref(normalized)
}
