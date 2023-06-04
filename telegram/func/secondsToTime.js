const secondsToTime = (sec) => {
  if (!sec) return null
  const hours = Math.floor(sec / 3600)
  const minutes = Math.floor(sec / 60)
  const seconds = sec % 60
  return `${padNum(hours, 2)}:${padNum(minutes, 2)}:${padNum(seconds, 2)}`
}

export default secondsToTime
