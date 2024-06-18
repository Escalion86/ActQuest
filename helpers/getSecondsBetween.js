function getSecondsBetween(start = new Date(), finish = new Date()) {
  return Math.floor(
    (new Date(finish || undefined).getTime() -
      new Date(start || undefined).getTime()) /
      1000
  )
}

export default getSecondsBetween
