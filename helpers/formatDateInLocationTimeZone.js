import getLocationTimeZone from './locationTimeZone'

const formatDateInLocationTimeZone = (
  value,
  locationKey,
  options = {},
) => {
  if (!value) {
    return null
  }

  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    return null
  }

  const formatterOptions = {
    dateStyle: 'short',
    timeStyle: 'short',
    ...options,
    timeZone: options.timeZone || getLocationTimeZone(locationKey),
  }

  try {
    return new Intl.DateTimeFormat('ru-RU', formatterOptions).format(date)
  } catch {
    const fallbackOptions = { ...formatterOptions }
    delete fallbackOptions.timeZone
    return new Intl.DateTimeFormat('ru-RU', fallbackOptions).format(date)
  }
}

export default formatDateInLocationTimeZone
