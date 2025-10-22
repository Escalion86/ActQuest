const UNITS = [
  { unit: 'minute', ms: 60 * 1000, limit: 60 },
  { unit: 'hour', ms: 60 * 60 * 1000, limit: 24 },
  { unit: 'day', ms: 24 * 60 * 60 * 1000, limit: 7 },
  { unit: 'week', ms: 7 * 24 * 60 * 60 * 1000, limit: 4 },
  { unit: 'month', ms: 30 * 24 * 60 * 60 * 1000, limit: 12 },
  { unit: 'year', ms: 365 * 24 * 60 * 60 * 1000, limit: Infinity },
]

const DEFAULT_LOCALE = 'ru'
const DEFAULT_FALLBACK = '—'

const formatRelativeTimeFromNow = (value, options = {}) => {
  const { fallback = DEFAULT_FALLBACK, locale = DEFAULT_LOCALE } = options

  if (!value) {
    return fallback
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return fallback
  }

  const diffMs = date.getTime() - Date.now()
  const absDiffMs = Math.abs(diffMs)

  if (absDiffMs < 45 * 1000) {
    return diffMs <= 0 ? 'только что' : 'через несколько секунд'
  }

  const hasRelativeTimeFormat =
    typeof Intl !== 'undefined' && typeof Intl.RelativeTimeFormat === 'function'

  if (!hasRelativeTimeFormat) {
    try {
      return date.toLocaleString(locale)
    } catch (error) {
      return date.toISOString()
    }
  }

  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })

  for (const { unit, ms, limit } of UNITS) {
    const diff = diffMs / ms

    if (Math.abs(diff) < limit) {
      return formatter.format(Math.round(diff), unit)
    }
  }

  const yearsDiff = diffMs / UNITS[UNITS.length - 1].ms
  return formatter.format(Math.round(yearsDiff), 'year')
}

export default formatRelativeTimeFromNow
