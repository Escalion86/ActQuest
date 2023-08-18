const secondsToTimeStr = (seconds) => {
  if (seconds == 0) return '0 секунд'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${h > 0 ? getNoun(h, 'час', 'часа', 'часов') : ''}
  ${m > 0 ? getNoun(m, 'минута', 'минуты', 'минут') : ''}
  ${s > 0 ? getNoun(s, 'секунда', 'секунды', 'секунд') : ''}`
}

export default secondsToTimeStr
