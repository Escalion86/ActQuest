import normalizeGameHistoryState from './normalizeGameHistoryState.js'
import sanitizeGameHistoryDisplayState from './sanitizeGameHistoryDisplayState.js'
import buildGameHistoryDiff from './buildGameHistoryDiff.js'
import buildGameHistorySummary from './buildGameHistorySummary.js'
import buildGameHistoryWarnings from './buildGameHistoryWarnings.js'
import buildGameHistoryActor from './buildGameHistoryActor.js'

const normalizeLocation = (value) =>
  typeof value === 'string' && value.trim() ? value.trim().toLowerCase() : null

// Сколько последних записей с snapshot храним на игру.
// Snapshot нужен только для rollback, поэтому старые снапшоты чистим,
// чтобы коллекция gamehistoryentries не раздувалась полными копиями игры.
const SNAPSHOT_RETENTION = 10

const pruneOldSnapshots = async ({ GameHistoryEntries, gameId }) => {
  const staleEntries = await GameHistoryEntries.find({
    gameId: String(gameId),
    snapshot: { $ne: null },
  })
    .sort({ createdAt: -1, _id: -1 })
    .skip(SNAPSHOT_RETENTION)
    .select({ _id: 1 })
    .lean()

  const staleIds = (Array.isArray(staleEntries) ? staleEntries : [])
    .map((entry) => entry?._id)
    .filter(Boolean)

  if (staleIds.length === 0) {
    return 0
  }

  const result = await GameHistoryEntries.updateMany(
    { _id: { $in: staleIds } },
    { $unset: { snapshot: '' } },
  )
  return Number(result?.modifiedCount) || 0
}

const recordGameHistoryEntry = async ({
  db,
  gameId,
  location = null,
  actionType,
  entityScope = 'mixed',
  actor = {},
  beforeState = null,
  afterState = null,
  context = {},
  snapshot = null,
  rollback = null,
} = {}) => {
  if (!db || !gameId || !actionType) {
    return null
  }

  const beforeNormalized = beforeState
    ? normalizeGameHistoryState(beforeState)
    : null
  const afterNormalized = afterState
    ? normalizeGameHistoryState(afterState)
    : null
  const before = beforeNormalized
    ? sanitizeGameHistoryDisplayState(beforeNormalized)
    : null
  const after = afterNormalized
    ? sanitizeGameHistoryDisplayState(afterNormalized)
    : null

  const warnings = buildGameHistoryWarnings({
    actionType,
    gameStatus:
      afterNormalized?.game?.status ?? beforeNormalized?.game?.status ?? '',
    context,
  })

  const GameHistoryEntries = db.model('GameHistoryEntries')
  // Полные before/after в БД не сохраняем: они нужны только в памяти
  // для подсчёта компактного diff. Rollback работает исключительно по snapshot.
  const entry = await GameHistoryEntries.create({
    gameId: String(gameId),
    location: normalizeLocation(location),
    actionType,
    entityScope,
    summary: buildGameHistorySummary({ actionType, context }),
    actor: buildGameHistoryActor(actor),
    warnings,
    diff: buildGameHistoryDiff({ before, after }),
    snapshot,
    rollback,
  })

  if (entry?.snapshot) {
    try {
      await pruneOldSnapshots({ GameHistoryEntries, gameId: entry.gameId })
    } catch (retentionError) {
      // Ретеншн snapshot не должен ронять основной запрос
      console.error('[game-history] Failed to prune old snapshots', {
        error: retentionError,
        gameId: entry.gameId,
      })
    }
  }

  return entry
}

export default recordGameHistoryEntry
