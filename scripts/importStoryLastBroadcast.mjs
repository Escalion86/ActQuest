import fs from 'node:fs'
import path from 'node:path'
import mongoose from 'mongoose'

import storyLastBroadcastScenario from '../data/storyLastBroadcastScenario.js'
import { getStoryValidationErrors } from '../helpers/isGameHaveErrors.js'

const loadEnv = (fileName) => {
  const filePath = path.resolve(process.cwd(), fileName)
  if (!fs.existsSync(filePath)) return
  fs.readFileSync(filePath, 'utf8').split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return
    const separator = trimmed.indexOf('=')
    if (separator <= 0) return
    const key = trimmed.slice(0, separator).trim()
    let value = trimmed.slice(separator + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1)
    if (process.env[key] === undefined) process.env[key] = value
  })
}

loadEnv('.env.local')
loadEnv('.env')

const getArgument = (name) => {
  const prefix = `--${name}=`
  const inline = process.argv.find((argument) => argument.startsWith(prefix))
  if (inline) return inline.slice(prefix.length)
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] || '' : ''
}

const gameId = getArgument('gameId').trim()
const apply = process.argv.includes('--apply')
if (!gameId) throw new Error('Укажите --gameId <id>. Без явного ID импорт запрещён.')
if (!process.env.MONGODB_URI || !process.env.MONGODB_GLOBAL_DBNAME) throw new Error('Не заданы MONGODB_URI или MONGODB_GLOBAL_DBNAME')

const validationErrors = getStoryValidationErrors(storyLastBroadcastScenario)
if (validationErrors.length > 0) {
  throw new Error(`Сценарий не прошёл validation: ${validationErrors.join('; ')}`)
}

const connection = await mongoose.createConnection(process.env.MONGODB_URI, { dbName: process.env.MONGODB_GLOBAL_DBNAME }).asPromise()
try {
  const Games = connection.collection('games')
  const filter = mongoose.isValidObjectId(gameId) ? { _id: new mongoose.Types.ObjectId(gameId) } : { id: gameId }
  const game = await Games.findOne(filter, { projection: { status: 1, name: 1 } })
  if (!game) throw new Error(`Игра ${gameId} не найдена`)
  if (['started', 'finished', 'closed'].includes(String(game.status || '').toLowerCase())) throw new Error('Запущенный или завершённый сценарий изменять нельзя')
  const update = { type: 'story', ...storyLastBroadcastScenario }
  if (!apply) {
    console.log(`[preview] «${game.name || gameId}» будет заменена сценарием «Последний эфир»: ${storyLastBroadcastScenario.storyNodes.length} локаций, ${storyLastBroadcastScenario.storyInteractions.length} сцен, ${storyLastBroadcastScenario.storyEvidence.length} улик, ${storyLastBroadcastScenario.storyEndings.length} концовок. Добавьте --apply.`)
  } else {
    const result = await Games.updateOne({ _id: game._id }, { $set: update })
    if (result.matchedCount !== 1) throw new Error('Игра исчезла во время импорта')
    const saved = await Games.findOne(
      { _id: game._id },
      { projection: { name: 1, type: 1, storyConfig: 1, storyItems: 1, storyNodes: 1, storyEdges: 1, storyEndings: 1, storyCharacters: 1, storyTopics: 1, storyInteractions: 1, storyEvidence: 1, storyAccusation: 1 } },
    )
    const savedValidationErrors = getStoryValidationErrors(saved)
    if (savedValidationErrors.length > 0) {
      throw new Error(`Записанный сценарий не прошёл validation: ${savedValidationErrors.join('; ')}`)
    }
    const savedCounts = {
      nodes: saved?.storyNodes?.length || 0,
      interactions: saved?.storyInteractions?.length || 0,
      evidence: saved?.storyEvidence?.length || 0,
      endings: saved?.storyEndings?.length || 0,
    }
    const expectedCounts = {
      nodes: storyLastBroadcastScenario.storyNodes.length,
      interactions: storyLastBroadcastScenario.storyInteractions.length,
      evidence: storyLastBroadcastScenario.storyEvidence.length,
      endings: storyLastBroadcastScenario.storyEndings.length,
    }
    if (JSON.stringify(savedCounts) !== JSON.stringify(expectedCounts)) {
      throw new Error(`Контрольное чтение после импорта не совпало: ${JSON.stringify(savedCounts)}`)
    }
    console.log(`[applied] Сценарий «Последний эфир» импортирован в ${String(game._id)} и проверен: ${savedCounts.nodes} локаций, ${savedCounts.interactions} сцен, ${savedCounts.evidence} улик, ${savedCounts.endings} концовок.`)
  }
} finally {
  await connection.close()
}
