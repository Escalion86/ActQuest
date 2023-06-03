function getSecondsBetween(start = new Date(), finish = new Date()) {
  return (new Date(finish).getTime() - new Date(start).getTime()) / 1000
}

export default getSecondsBetween
