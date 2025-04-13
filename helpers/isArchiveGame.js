const isArchiveGame = (game) =>
  game.status === 'finished' || game.status === 'canceled'

export default isArchiveGame
