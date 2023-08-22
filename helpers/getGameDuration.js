import getMinutesBetween from './getMinutesBetween'

const getGameDuration = (game) =>
  getMinutesBetween(game.dateStartFact, game.dateEndFact)

export default getGameDuration
