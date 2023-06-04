const twoChars = (num) => (num <= 9 ? `0${num}` : `${num}`)

const secondsToTime = (sec) => {
  if (!sec) return null
  const hours = Math.floor(sec / 3600)
  const minutes = Math.floor(sec / 60)
  const seconds = sec % 60
  return `${twoChars(hours)}:${twoChars(minutes)}:${twoChars(seconds)}`
}

export default secondsToTime
