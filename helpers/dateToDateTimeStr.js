import moment from 'moment-timezone'
import { DAYS_OF_WEEK, MONTHS, MONTHS_FULL } from './constants'

const dateToDateTimeStr = (
  date,
  showDayOfWeek = true,
  fullMonth,
  showYear = true,
  fullSeparete = false
) => {
  var d = moment.tz(date, 'Asia/Krasnoyarsk')
  var week = d.weekday()
  var obj = d.toObject()
  const { minutes, hours, months, date, years } = obj

  if (minutes.length < 2) minutes = '0' + minutes
  if (hours.length < 2) hours = '0' + hours

  if (fullSeparete)
    return [
      date,
      MONTHS_FULL[months - 1],
      DAYS_OF_WEEK[week],
      years.toString(),
      hours,
      minutes,
    ]

  const strDateStart =
    date +
    ' ' +
    (fullMonth ? MONTHS_FULL[months - 1] : MONTHS[months - 1]) +
    (showYear ? ' ' + years.toString() : '') +
    (showDayOfWeek ? ' ' + DAYS_OF_WEEK[week] : '')

  const strTimeStart = hours + ':' + minutes
  return [strDateStart, strTimeStart]
}

export default dateToDateTimeStr
