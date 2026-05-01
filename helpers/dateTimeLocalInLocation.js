import moment from 'moment-timezone'

import getLocationTimeZone from './locationTimeZone'

const DATETIME_LOCAL_FORMAT = 'YYYY-MM-DDTHH:mm'

export const formatDateTimeLocalInLocation = (value, locationKey) => {
  if (!value) {
    return ''
  }

  const timeZone = getLocationTimeZone(locationKey)
  const parsed = moment(value)
  if (!parsed.isValid()) {
    return ''
  }

  return parsed.tz(timeZone).format(DATETIME_LOCAL_FORMAT)
}

export const parseDateTimeLocalInLocation = (value, locationKey) => {
  if (typeof value !== 'string' || !value.trim()) {
    return null
  }

  const timeZone = getLocationTimeZone(locationKey)
  const parsed = moment.tz(value.trim(), DATETIME_LOCAL_FORMAT, true, timeZone)
  return parsed.isValid() ? parsed.toDate().toISOString() : null
}
