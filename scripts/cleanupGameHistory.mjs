import fs from 'node:fs'
import path from 'node:path'
import mongoose from 'mongoose'

// Очистка раздувшейся истории изменений игр (gamehistoryentries):
// 1) у всех записей удаляет полные before/after (в БД остаётся компактный diff);
// 2) snapshot (нужен только для rollback) оставляет только у последних
//    SNAPSHOT_RETENTION записей каждой игры.
//
// По умолчанию — dry-run (только отчёт). Запись:
//   node scripts/cleanupGameHistory.mjs --apply --confirm-db=<имя БД>
// Опционально ограничить одной игрой: --gameId=<id>

const BATCH_SIZE = 500
// Должно совпадать с SNAPSHOT_RETENTION в server/gameHistory/recordGameHistoryEntry.js
const SNAPSHOT_RETENTION = 10

const loadEnvFile = (fileName) => {
  const filePath = path.resolve(process.cwd(), fileName)
  if (!fs.existsSync(filePath)) return

  fs.readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .forEach((line) => {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) return
      const separator = trimmed.indexOf('=')
      if (separator <= 0) return

      const key = trimmed.slice(0, separator).trim()
      let value = trimmed.slice(separator + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      if (typeof process.env[key] === 'undefined') {
        process.env[key] = value
      }
    })
}

loadEnvFile('.env.local')
loadEnvFile('.env')

const args = process.argv.slice(2)
const isApply = args.includes('--apply')
const confirmedDbName =
  args
    .find((arg) => arg.startsWith('--confirm-db='))
    ?.slice('--confirm-db='.length)
    .trim() || ''
const onlyGameId =
  args
    .find((arg) => arg.startsWith('--gameId='))
    ?.slice('--gameId='.length)
    .trim() || ''

const formatMb = (bytes) => `${(Number(bytes) / 1024 / 1024).toFixed(1)} МБ`

const getCollectionSize = async (collection) => {
  try {
    const stats = await collection.stats()
    return Number(stats?.size) || 0
  } catch {
    return null
  }
}

// Приблизительный размер полей before/after/snapshot через $bsonSize (MongoDB 4.4+).
// Если агрегация не поддерживается — возвращаем null.
const estimateFieldsSize = async (collection, filter) => {
  try {
    const [result] = await collection
      .aggregate([
        { $match: filter },
        {
          $project: {
            beforeSize: { $bsonSize: { $ifNull: ['$before', null] } },
            afterSize: { $bsonSize: { $ifNull: ['$after', null] } },
            snapshotSize: { $bsonSize: { $ifNull: ['$snapshot', null] } },
          },
        },
        {
          $group: {
            _id: null,
            beforeSize: { $sum: '$beforeSize' },
            afterSize: { $sum: '$afterSize' },
            snapshotSize: { $sum: '$snapshotSize' },
          },
        },
      ])
      .toArray()
    return result ?? null
  } catch {
    return null
  }
}

const runBulkWrite = async (collection, operations) => {
  let modifiedCount = 0
  for (let index = 0; index < operations.length; index += BATCH_SIZE) {
    const batch = operations.slice(index, index + BATCH_SIZE)
    const result = await collection.bulkWrite(batch, { ordered: false })
    modifiedCount += Number(result.modifiedCount) || 0
  }
  return modifiedCount
}

const run = async () => {
  const mongoUri = process.env.MONGODB_URI
  const dbName = process.env.MONGODB_GLOBAL_DBNAME
  if (!mongoUri || !dbName) {
    throw new Error('Не заданы MONGODB_URI или MONGODB_GLOBAL_DBNAME')
  }
  if (isApply && confirmedDbName !== dbName) {
    throw new Error(`Для записи подтвердите базу: --confirm-db=${dbName}`)
  }

  const connection = await mongoose
    .createConnection(mongoUri, { dbName })
    .asPromise()

  try {
    const GameHistoryEntries = connection.collection('gamehistoryentries')
    const baseFilter = onlyGameId ? { gameId: onlyGameId } : {}

    const sizeBefore = await getCollectionSize(GameHistoryEntries)

    const totalCount = await GameHistoryEntries.countDocuments(baseFilter)
    const beforeAfterFilter = {
      ...baseFilter,
      $or: [{ before: { $exists: true } }, { after: { $exists: true } }],
    }
    const withBeforeAfterCount =
      await GameHistoryEntries.countDocuments(beforeAfterFilter)

    // Записи со snapshot, у которых snapshot лишний (старше ретеншна на игру)
    const gameIds = onlyGameId
      ? [onlyGameId]
      : await GameHistoryEntries.distinct('gameId', {
          snapshot: { $ne: null },
        })

    const staleSnapshotIds = []
    const perGame = []
    for (const gameId of gameIds) {
      const snapshotEntries = await GameHistoryEntries.find({
        gameId,
        snapshot: { $ne: null },
      })
        .sort({ createdAt: -1, _id: -1 })
        .project({ _id: 1 })
        .toArray()

      const stale = snapshotEntries.slice(SNAPSHOT_RETENTION)
      if (stale.length > 0) {
        stale.forEach((entry) => staleSnapshotIds.push(entry._id))
        perGame.push({
          gameId,
          snapshotsTotal: snapshotEntries.length,
          snapshotsToRemove: stale.length,
        })
      }
    }

    const sizes = await estimateFieldsSize(GameHistoryEntries, baseFilter)
    const staleSnapshotSizes = staleSnapshotIds.length
      ? await estimateFieldsSize(GameHistoryEntries, {
          _id: { $in: staleSnapshotIds },
        })
      : null

    const report = {
      mode: isApply ? 'apply' : 'dry-run',
      generatedAt: new Date().toISOString(),
      dbName,
      gameId: onlyGameId || null,
      snapshotRetention: SNAPSHOT_RETENTION,
      entries: {
        total: totalCount,
        withBeforeAfter: withBeforeAfterCount,
        staleSnapshots: staleSnapshotIds.length,
      },
      estimatedSizes: sizes
        ? {
            before: formatMb(sizes.beforeSize),
            after: formatMb(sizes.afterSize),
            snapshotsTotal: formatMb(sizes.snapshotSize),
            staleSnapshots: staleSnapshotSizes
              ? formatMb(staleSnapshotSizes.snapshotSize)
              : null,
          }
        : 'недоступно (версия MongoDB без $bsonSize)',
      collectionSizeBefore:
        sizeBefore === null ? 'недоступно' : formatMb(sizeBefore),
      perGameSnapshotCleanup: perGame.slice(0, 50),
      perGameSnapshotCleanupTruncated: perGame.length > 50,
    }

    if (!isApply) {
      console.log(JSON.stringify(report, null, 2))
      console.log(
        `\nДля применения: node scripts/cleanupGameHistory.mjs --apply --confirm-db=${dbName}` +
          (onlyGameId ? ` --gameId=${onlyGameId}` : ''),
      )
      return
    }

    // 1) Удаляем before/after у всех записей
    const beforeAfterResult = await GameHistoryEntries.updateMany(
      beforeAfterFilter,
      { $unset: { before: '', after: '' } },
    )
    report.entries.beforeAfterRemoved =
      Number(beforeAfterResult.modifiedCount) || 0

    // 2) Удаляем лишние snapshot батчами
    const snapshotOperations = staleSnapshotIds.map((id) => ({
      updateOne: { filter: { _id: id }, update: { $unset: { snapshot: '' } } },
    }))
    report.entries.snapshotsRemoved = await runBulkWrite(
      GameHistoryEntries,
      snapshotOperations,
    )

    const sizeAfter = await getCollectionSize(GameHistoryEntries)
    report.collectionSizeAfter =
      sizeAfter === null ? 'недоступно' : formatMb(sizeAfter)

    console.log(JSON.stringify(report, null, 2))
    console.log(
      '\nВажно: физическое место на диске MongoDB вернёт только после compact/пересоздания коллекции, ' +
        'но новые документы уже будут переиспользовать освобождённое пространство.',
    )
  } finally {
    await connection.close()
  }
}

run().catch((error) => {
  console.error('[cleanup:game-history] Ошибка')
  console.error(error)
  process.exitCode = 1
})
