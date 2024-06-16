import getNoun from './getNoun'

const secondsToTimeStr = (seconds, short) => {
  if (seconds <= 0) return '0 секунд'
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  var result = []
  if (d > 0) result.push(short ? d + 'д' : getNoun(d, 'день', 'дня', 'дней'))
  if (h > 0) result.push(short ? h + 'ч' : getNoun(h, 'час', 'часа', 'часов'))
  if (m > 0)
    result.push(short ? m + 'м' : getNoun(m, 'минута', 'минуты', 'минут'))
  if (s > 0)
    result.push(short ? s + 'с' : getNoun(s, 'секунда', 'секунды', 'секунд'))
  return result.join(' ')
}

export default secondsToTimeStr
