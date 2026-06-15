export default function getGameProcessFinishingPlace(game) {
  if (!game || typeof game.finishingPlace !== 'string') {
    return ''
  }

  return game.finishingPlace.trim()
}
