const secondsToTimeStr = (seconds) => {
  if (seconds == 0) return '0 секунд'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const seconds = seconds % 60
  return `${hours > 0 ? getNoun(hours, 'час', 'часа', 'часов') : ''}
  ${minutes > 0 ? getNoun(minutes, 'минута', 'минуты', 'минут') : ''}
  ${seconds > 0 ? getNoun(seconds, 'секунда', 'секунды', 'секунд') : ''}`
}

export default secondsToTimeStr
