import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import mongoose from 'mongoose'
import { createRequire } from 'node:module'
import { acquireGameProcessLock, releaseGameProcessLock, guardGameProgressModel, refreshProgressGame } from '../server/gameProcessLock.js'
import withGameTeamsLocked from '../server/withGameTeamsLocked.js'

createRequire(import.meta.url)('@next/env').loadEnvConfig(process.cwd())
const uri = process.env.MONGODB_URI
if (!/^mongodb:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(uri || '')) {
  throw new Error('Проверка разрешена только на локальной MongoDB')
}
// Создаём и удаляем только уникальную тестовую БД, не базу приложения.
const dbName = `actquest_lock_test_${randomUUID().replaceAll('-', '')}`
const db = await mongoose.createConnection(uri, { dbName }).asPromise()
try {
  const lockSchema = new mongoose.Schema({ token: String, acquiredAt: Date, expiresAt: Date }, { _id: false })
  const Games = db.model('Games', new mongoose.Schema({ status: String, gameProcessLock: lockSchema }, { strict: false }))
  const Teams = db.model('GamesTeams', new mongoose.Schema({ gameId: String, gameProcessLock: lockSchema, answer: String }))
  const game = await Games.create({ status: 'started' })
  const team = await Teams.create({ gameId: String(game._id) })
  const first = await acquireGameProcessLock({ GamesTeams: Teams, teamId: team._id })
  assert.equal(first.acquired, true)
  await guardGameProgressModel(Teams, first).findByIdAndUpdate(team._id, { answer: 'принят' }).lean()
  await Teams.updateOne({ _id: team._id }, { $set: { 'gameProcessLock.expiresAt': new Date(0) } })
  await assert.rejects(async () => await guardGameProgressModel(Teams, first).findByIdAndUpdate(team._id, { answer: 'устаревший' }), { statusCode: 409 })
  const pending = await acquireGameProcessLock({ GamesTeams: Teams, teamId: team._id })
  const stopping = withGameTeamsLocked({ db, gameId: game._id }, async ({ teams, Games: guardedGames, assertHeld }) => {
    assert.equal(teams[0].answer, 'последний ответ')
    await assertHeld()
    await guardedGames.findByIdAndUpdate(game._id, { status: 'finished' })
  })
  await guardGameProgressModel(Teams, pending).findByIdAndUpdate(team._id, { answer: 'последний ответ' })
  await releaseGameProcessLock({ GamesTeams: Teams, teamId: team._id, token: pending.token })
  await stopping
  assert.equal((await refreshProgressGame(Teams, game)).status, 'finished')
  assert.equal((await Teams.findById(team._id).lean()).gameProcessLock, undefined)
  console.log('MongoDB/Mongoose: запись с блокировкой, отказ просроченной записи, СТОП после ответа и освобождение блокировок — OK')
} finally {
  assert.equal(db.name, dbName)
  await db.dropDatabase()
  await db.close()
}
