import normalizeGameHistoryState from './normalizeGameHistoryState.js'
import sanitizeGameHistoryDisplayState from './sanitizeGameHistoryDisplayState.js'
import buildGameHistoryDiff from './buildGameHistoryDiff.js'
import buildGameHistorySummary from './buildGameHistorySummary.js'
import buildGameHistoryWarnings from './buildGameHistoryWarnings.js'
import buildGameHistoryActor from './buildGameHistoryActor.js'

const normalizeLocation = (value) =>
  typeof value === 'string' && value.trim() ? value.trim().toLowerCase() : null

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
  return GameHistoryEntries.create({
    gameId: String(gameId),
    location: normalizeLocation(location),
    actionType,
    entityScope,
    summary: buildGameHistorySummary({ actionType, context }),
    actor: buildGameHistoryActor(actor),
    warnings,
    before,
    after,
    diff: buildGameHistoryDiff({ before, after }),
    snapshot,
    rollback,
  })
}

export default recordGameHistoryEntry
