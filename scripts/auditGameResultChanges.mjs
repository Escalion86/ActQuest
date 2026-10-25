import { createRequire } from 'node:module'
import { MongoClient, ObjectId } from 'mongodb'
import buildGameResultComputed from '../server/buildGameResultComputed.js'

const require = createRequire(import.meta.url)
require('@next/env').loadEnvConfig(process.cwd())
const args = process.argv.slice(2)
const gameId = args.includes('--game') ? args[args.indexOf('--game') + 1] : null
if (gameId && !ObjectId.isValid(gameId)) throw new Error('Некорректный --game')
const client = new MongoClient(process.env.MONGODB_URI)
try {
  await client.connect()
  const games = client.db(process.env.MONGODB_GLOBAL_DBNAME).collection('games')
  const cursor = games.find({ status: { $in: ['finished', 'closed'] }, ...(gameId ? { _id: new ObjectId(gameId) } : {}) })
  let checked = 0, changed = 0
  for await (const game of cursor) {
    if (!game.result?.computed) continue
    checked++
    try {
      const next = await buildGameResultComputed({ game })
      const allTeams = (result) => [...(result?.teams || []), ...(result?.outOfCompetitionTeams || [])]
      const oldTeams = new Map(allTeams(game.result.computed).map((team) => [String(team.teamId), team]))
      const changes = allTeams(next.computed).flatMap((team) => {
        const before = oldTeams.get(String(team.teamId))
        if (!before || (before.finalSeconds === team.finalSeconds && before.place === team.place)) return []
        return [{ teamId: team.teamId, before: { seconds: before.finalSeconds, place: before.place }, after: { seconds: team.finalSeconds, place: team.place } }]
      })
      if (changes.length) {
        changed++
        console.log(JSON.stringify({ gameId: String(game._id), name: game.name, changes }))
      }
    } catch (error) {
      console.error(JSON.stringify({ gameId: String(game._id), error: error.message }))
      process.exitCode = 1
    }
  }
  console.log(JSON.stringify({ checked, changed, writes: 0 }))
} finally {
  await client.close()
}
