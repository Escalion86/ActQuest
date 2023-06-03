const secondsToTime = (sec) => {
  if (!sec) return '?'
  const minutes = Math.floor(sec / 60)
  const seconds = sec % 60
  return `${minutes} мин ${seconds} сек`
}

export default secondsToTime
