const ROLLBACK_RATING_WARNING =
  'Откат может повлиять на рейтинги и закрытую статистику. Они не пересчитываются автоматически.'

const normalizeString = (value) =>
  value === null || value === undefined ? '' : String(value).trim()

const rollbackGameToHistoryEntry = async ({
  db,
  gameId,
  historyEntry,
  rolledBackEntriesCount = null,
} = {}) => {
  if (!db || !gameId || !historyEntry?.snapshot) {
    throw new Error('Недостаточно данных для rollback игры')
  }

  const snapshotGame = historyEntry.snapshot?.game
  const snapshotGameTeams = Array.isArray(historyEntry.snapshot?.gameTeams)
    ? historyEntry.snapshot.gameTeams
    : []

  if (!snapshotGame || normalizeString(snapshotGame?._id) !== normalizeString(gameId)) {
    throw new Error('Snapshot не соответствует выбранной игре')
  }

  const Games = db.model('Games')
  const GamesTeams = db.model('GamesTeams')

  const currentGame = await Games.findById(gameId)
  const currentGameTeams = await GamesTeams.find({ gameId }).lean()

  await Games.replaceOne({ _id: gameId }, snapshotGame)

  const currentIds = new Set(
    (Array.isArray(currentGameTeams) ? currentGameTeams : [])
      .map((entry) => normalizeString(entry?._id))
      .filter(Boolean),
  )
  const snapshotIds = new Set(
    snapshotGameTeams
      .map((entry) => normalizeString(entry?._id))
      .filter(Boolean),
  )

  const idsToDelete = Array.from(currentIds).filter((id) => !snapshotIds.has(id))
  if (idsToDelete.length > 0) {
    await GamesTeams.deleteMany({
      gameId,
      _id: { $in: idsToDelete },
    })
  }

  for (const entry of snapshotGameTeams) {
    const normalizedId = normalizeString(entry?._id)
    if (!normalizedId) {
      continue
    }

    await GamesTeams.updateOne(
      { _id: normalizedId, gameId },
      { $set: entry },
      { upsert: true },
    )
  }

  return {
    restoredEntryId: normalizeString(historyEntry?._id) || null,
    rolledBackEntriesCount,
    currentState: {
      game: currentGame,
      gameTeams: Array.isArray(currentGameTeams) ? currentGameTeams : [],
    },
    restoredState: {
      game: snapshotGame,
      gameTeams: snapshotGameTeams,
    },
    warnings: [ROLLBACK_RATING_WARNING],
  }
}

export default rollbackGameToHistoryEntry
