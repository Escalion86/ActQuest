export default function groupPublicGameDates(games) {
  const groups = new Map()
  for (const game of games) {
    const key = game.stageId ? `stage:${game.stageId}` : `game:${game._id}`
    if (!groups.has(key)) groups.set(key, { key, name: game.name, games: [] })
    groups.get(key).games.push(game)
  }
  return Array.from(groups.values())
}
