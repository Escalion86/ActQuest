import moment from 'moment-timezone'
import { DAYS_OF_WEEK, MONTHS, MONTHS_FULL } from './constants'
import padNum from 'telegram/func/padNum'

const dateToDateTimeStr = (
  dateTime,
  showDayOfWeek = true,
  fullMonth,
  showYear = true,
  fullSeparete = false
) => {
  var d = moment.tz(dateTime, 'Asia/Krasnoyarsk')
  var week = d.weekday()
  var obj = d.toObject()
  const { minutes, hours, months, date, years, seconds } = obj

  if (fullSeparete)
    return [
      date,
      MONTHS_FULL[months],
      DAYS_OF_WEEK[week],
      years.toString(),
      padNum(hours, 2),
      padNum(minutes, 2),
      padNum(seconds, 2),
    ]

  const strDateStart =
    date +
    ' ' +
    (fullMonth ? MONTHS_FULL[months] : MONTHS[months]) +
    (showYear ? ' ' + years.toString() : '') +
    (showDayOfWeek ? ' ' + DAYS_OF_WEEK[week] : '')

  const strTimeStart =
    padNum(hours, 2) + ':' + padNum(minutes, 2) + ':' + padNum(seconds, 2)
  return [strDateStart, strTimeStart]
}

export default dateToDateTimeStr
