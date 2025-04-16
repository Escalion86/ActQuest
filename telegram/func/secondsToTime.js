import padNum from './padNum'

const secondsToTime = (sec) => {
  if (sec === 0) return '00:00:00'
  if (!sec) return null
  const tempSec = Math.abs(sec)
  const hours = Math.floor(tempSec / 3600)
  const minutes = Math.floor((tempSec % 3600) / 60)
  const seconds = tempSec % 60
  return `${sec < 0 ? '-' : ''}${padNum(hours, 2)}:${padNum(
    minutes,
    2
  )}:${padNum(seconds, 2)}`
}

export default secondsToTime
