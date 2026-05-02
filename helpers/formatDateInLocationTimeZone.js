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

  const hasExplicitDateTimeOptions = [
    'weekday',
    'era',
    'year',
    'month',
    'day',
    'dayPeriod',
    'hour',
    'minute',
    'second',
    'fractionalSecondDigits',
  ].some((key) => Object.prototype.hasOwnProperty.call(options, key))

  const formatterOptions = {
    ...(hasExplicitDateTimeOptions
      ? {}
      : { dateStyle: 'short', timeStyle: 'short' }),
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
