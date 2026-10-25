import { createRequire } from 'node:module'
import { writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MongoClient, ObjectId, BSON } from 'mongodb'
import { isValidTaskSequence } from '../helpers/taskDistribution.js'

const require = createRequire(import.meta.url)
require('@next/env').loadEnvConfig(process.cwd())

// По умолчанию только диагностика. Запись требует --apply и точных ID.
const args = process.argv.slice(2)
const option = (name) => args[args.indexOf(name) + 1]
const gameId = args.includes('--game') ? option('--game') : ''
const teamId = args.includes('--team') ? option('--team') : ''
if (!ObjectId.isValid(gameId) || !ObjectId.isValid(teamId)) {
  throw new Error('Укажите --game <ID игры> --team <ID команды> [--apply]')
}

const client = new MongoClient(process.env.MONGODB_URI)
try {
  await client.connect()
  const db = client.db(process.env.MONGODB_GLOBAL_DBNAME)
  const game = await db.collection('games').findOne({ _id: new ObjectId(gameId) })
  const collection = db.collection('gamesteams')
  const team = await collection.findOne({ gameId, teamId })
  const count = game?.tasks?.length || 0
  if (!game || game.status !== 'started' || game.type !== 'classic' || !team) {
    throw new Error('Не найдена команда в запущенной классической игре')
  }
  const first = team.taskSequence?.[0]
  const starts = team.startTime
  if (!isValidTaskSequence(team.taskSequence, count) || first === 0 ||
      team.activeNum !== 0 || !Array.isArray(starts) || starts.length !== count ||
      !(starts[0] instanceof Date) || Number.isNaN(starts[0].getTime()) ||
      starts.slice(1).some((value) => value != null) ||
      (team.endTime || []).some((value) => value != null) ||
      (team.taskFailures || []).length || (team.codeAttempts || []).length ||
      ['findedCodes', 'wrongCodes', 'findedBonusCodes', 'findedPenaltyCodes'].some(
        (key) => (team[key] || []).some((values) => values?.length),
      )) {
    throw new Error('Состояние не соответствует ошибке начального таймера; автоматическое исправление отменено')
  }
  const corrected = [...starts]
  corrected[first] = starts[0]
  corrected[0] = null
  console.log(JSON.stringify({ gameId, teamId, firstTask: first + 1,
    before: starts, after: corrected, apply: args.includes('--apply') }, null, 2))
  if (args.includes('--apply')) {
    const backup = join(tmpdir(), `actquest-task-start-${team._id}-${Date.now()}.json`)
    await writeFile(backup, BSON.EJSON.stringify(team, null, 2), { flag: 'wx' })
    console.log('Резервная копия:', backup)
    const result = await collection.updateOne({
      _id: team._id, activeNum: 0, startTime: team.startTime,
      taskSequence: team.taskSequence, updatedAt: team.updatedAt,
      codeAttempts: team.codeAttempts || [],
    }, { $set: { startTime: corrected, updatedAt: new Date() } })
    if (result.modifiedCount !== 1) throw new Error('Команда изменилась во время проверки; запись отменена')
    console.log('Время старта восстановлено без перезапуска игры')
  }
} finally {
  await client.close()
}
