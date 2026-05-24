import normalizeGameHistoryState from './normalizeGameHistoryState.js'

const GAME_HISTORY_SNAPSHOT_SCHEMA_VERSION = 1

const buildGameHistorySnapshot = (state) => ({
  schemaVersion: GAME_HISTORY_SNAPSHOT_SCHEMA_VERSION,
  capturedAt: new Date().toISOString(),
  ...normalizeGameHistoryState(state),
})

export default buildGameHistorySnapshot
export { GAME_HISTORY_SNAPSHOT_SCHEMA_VERSION }
