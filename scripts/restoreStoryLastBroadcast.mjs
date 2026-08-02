import fs from 'node:fs'
import path from 'node:path'
import mongoose from 'mongoose'

import baseScenario from '../data/storyLastBroadcastScenario.js'
import attachStoryLastBroadcastMedia from '../helpers/attachStoryLastBroadcastMedia.js'
import { getStoryValidationErrors } from '../helpers/isGameHaveErrors.js'

const loadEnv = (fileName) => {
  const filePath = path.resolve(process.cwd(), fileName)
  if (!fs.existsSync(filePath)) return
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const separator = trimmed.indexOf('=')
    if (separator <= 0) continue
    const key = trimmed.slice(0, separator).trim()
    let value = trimmed.slice(separator + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = value
  }
}

loadEnv('.env.local')
loadEnv('.env')

const getArgument = (name, fallback = '') => {
  const prefix = `--${name}=`
  const inline = process.argv.find((argument) => argument.startsWith(prefix))
  if (inline) return inline.slice(prefix.length)
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] || fallback : fallback
}

const gameId = getArgument('gameId').trim()
const location = getArgument('location', 'krsk').trim().toLowerCase()
const apply = process.argv.includes('--apply')
const restoreMissing = process.argv.includes('--restore-missing')
if (!mongoose.isValidObjectId(gameId)) {
  throw new Error('Укажите корректный --gameId')
}
if (!process.env.MONGODB_URI || !process.env.MONGODB_GLOBAL_DBNAME) {
  throw new Error('Не заданы MONGODB_URI или MONGODB_GLOBAL_DBNAME')
}

const mediaManifestPath = path.resolve(
  process.cwd(),
  'data/storyLastBroadcastMediaManifest.json',
)
if (!fs.existsSync(mediaManifestPath)) {
  throw new Error('Сначала загрузите медиа и создайте медиаманифест')
}
const mediaManifest = JSON.parse(fs.readFileSync(mediaManifestPath, 'utf8'))
const scenario = attachStoryLastBroadcastMedia(baseScenario, mediaManifest)
const validationErrors = getStoryValidationErrors(scenario)
if (validationErrors.length) {
  throw new Error(`Сценарий не прошёл validation: ${validationErrors.join('; ')}`)
}

const mediaAudit = {
  cover: Boolean(scenario.image),
  characterImages: scenario.storyCharacters.filter((item) => item.image).length,
  nodeMedia: scenario.storyNodes.reduce(
    (sum, item) => sum + (item.media?.length || 0),
    0,
  ),
  itemImages: scenario.storyItems.filter((item) => item.image).length,
  itemMedia: scenario.storyItems.reduce(
    (sum, item) => sum + (item.media?.length || 0),
    0,
  ),
  interactionAudio: scenario.storyInteractions.filter((item) =>
    item.media?.some((media) => media.type === 'audio' && media.url),
  ).length,
  endingMedia: scenario.storyEndings.reduce(
    (sum, item) => sum + (item.media?.length || 0),
    0,
  ),
  evidenceMedia: scenario.storyEvidence.reduce(
    (sum, item) => sum + (item.media?.length || 0),
    0,
  ),
}

const objectId = new mongoose.Types.ObjectId(gameId)
const connection = await mongoose
  .createConnection(process.env.MONGODB_URI, {
    dbName: process.env.MONGODB_GLOBAL_DBNAME,
  })
  .asPromise()

try {
  const games = connection.collection('games')
  const existing = await games.findOne(
    { _id: objectId },
    { projection: { name: 1, status: 1, type: 1, location: 1 } },
  )
  if (!existing && !restoreMissing) {
    throw new Error(
      'Игра отсутствует. Для восстановления удалённой записи добавьте --restore-missing.',
    )
  }
  if (
    existing &&
    ['started', 'finished', 'closed'].includes(
      String(existing.status || '').toLowerCase(),
    )
  ) {
    throw new Error('Запущенную или завершённую игру восстанавливать поверх нельзя')
  }

  const now = new Date()
  const gameData = {
    ...scenario,
    location,
    status: 'active',
    hidden: true,
    isRated: false,
    individualStart: false,
    participationMode: 'team',
    showTasksAudience: 'all',
    tasks: [],
    dateStart: new Date('2026-07-15T11:00:00.000Z'),
    updatedAt: now,
  }

  console.log(
    JSON.stringify(
      {
        mode: apply ? 'apply' : 'preview',
        action: existing ? 'update' : 'restore',
        gameId,
        location,
        status: gameData.status,
        hidden: gameData.hidden,
        counts: {
          nodes: scenario.storyNodes.length,
          characters: scenario.storyCharacters.length,
          items: scenario.storyItems.length,
          interactions: scenario.storyInteractions.length,
          evidence: scenario.storyEvidence.length,
          endings: scenario.storyEndings.length,
        },
        mediaAudit,
      },
      null,
      2,
    ),
  )

  if (!apply) process.exit(0)

  if (existing) {
    const result = await games.updateOne({ _id: objectId }, { $set: gameData })
    if (result.matchedCount !== 1) throw new Error('Игра исчезла во время записи')
  } else {
    await games.insertOne({
      _id: objectId,
      ...gameData,
      createdAt: objectId.getTimestamp(),
    })
  }

  const saved = await games.findOne({ _id: objectId })
  if (!saved) throw new Error('Контрольное чтение не нашло восстановленную игру')
  const savedErrors = getStoryValidationErrors(saved)
  if (savedErrors.length) {
    throw new Error(`Записанная игра не прошла validation: ${savedErrors.join('; ')}`)
  }
  const savedMediaAudit = {
    cover: Boolean(saved.image),
    characterImages: saved.storyCharacters?.filter((item) => item.image).length || 0,
    nodeMedia:
      saved.storyNodes?.reduce((sum, item) => sum + (item.media?.length || 0), 0) || 0,
    itemImages: saved.storyItems?.filter((item) => item.image).length || 0,
    interactionAudio:
      saved.storyInteractions?.filter((item) =>
        item.media?.some((media) => media.type === 'audio' && media.url),
      ).length || 0,
    endingMedia:
      saved.storyEndings?.reduce(
        (sum, item) => sum + (item.media?.length || 0),
        0,
      ) || 0,
  }
  if (JSON.stringify(savedMediaAudit) !== JSON.stringify({
    cover: mediaAudit.cover,
    characterImages: mediaAudit.characterImages,
    nodeMedia: mediaAudit.nodeMedia,
    itemImages: mediaAudit.itemImages,
    interactionAudio: mediaAudit.interactionAudio,
    endingMedia: mediaAudit.endingMedia,
  })) {
    throw new Error(`Контроль медиа не совпал: ${JSON.stringify(savedMediaAudit)}`)
  }
  console.log(
    JSON.stringify(
      {
        restored: true,
        gameId: String(saved._id),
        name: saved.name,
        status: saved.status,
        location: saved.location,
        mediaAudit: savedMediaAudit,
      },
      null,
      2,
    ),
  )
} finally {
  await connection.close()
}
