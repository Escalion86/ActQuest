import { toStringId } from '../helpers/idAndDate.js'

const TERMINAL_STATUSES = new Set(['completed', 'failed'])

const toDate = (value) => {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const toDurationSeconds = (progress) => {
  const startedAt = toDate(progress?.startedAt)
  const finishedAt = toDate(progress?.finishedAt)
  if (!startedAt || !finishedAt) return null
  return Math.max(
    0,
    Math.round((finishedAt.getTime() - startedAt.getTime()) / 1000),
  )
}

const average = (values) => {
  const finite = values.filter(Number.isFinite)
  if (finite.length === 0) return null
  return Math.round(finite.reduce((sum, value) => sum + value, 0) / finite.length)
}

const compareNullableNumbers = (first, second, fallback = Infinity) =>
  (Number.isFinite(first) ? first : fallback) -
  (Number.isFinite(second) ? second : fallback)

const compareScoreRecords = (first, second) =>
  second.score - first.score ||
  compareNullableNumbers(first.durationSeconds, second.durationSeconds) ||
  first.usedCluesCount - second.usedCluesCount ||
  String(first.finishedAt || '').localeCompare(String(second.finishedAt || ''))

const compareFastestRecords = (first, second) =>
  compareNullableNumbers(first.durationSeconds, second.durationSeconds) ||
  second.score - first.score ||
  first.usedCluesCount - second.usedCluesCount ||
  String(first.finishedAt || '').localeCompare(String(second.finishedAt || ''))

const compareClueRecords = (first, second) =>
  first.usedCluesCount - second.usedCluesCount ||
  second.score - first.score ||
  compareNullableNumbers(first.durationSeconds, second.durationSeconds) ||
  String(first.finishedAt || '').localeCompare(String(second.finishedAt || ''))

const rankRecords = (records, compare, limit) =>
  [...records]
    .sort(compare)
    .slice(0, limit)
    .map((entry, index) => ({ ...entry, rank: index + 1 }))

export const buildStoryRecords = ({
  game,
  gameTeams = [],
  teams = [],
  showNames = true,
  limit = 10,
}) => {
  const teamsById = new Map(
    (Array.isArray(teams) ? teams : []).map((team) => [
      toStringId(team?._id ?? team?.id),
      team,
    ]),
  )
  const endingTitles = new Map(
    (Array.isArray(game?.storyEndings) ? game.storyEndings : []).map(
      (ending) => [toStringId(ending?.id), String(ending?.title || '').trim()],
    ),
  )

  const entries = (Array.isArray(gameTeams) ? gameTeams : [])
    .filter((gameTeam) => !gameTeam?.outOfCompetition)
    .map((gameTeam, index) => {
      const progress = gameTeam?.storyProgress || {}
      const teamId = toStringId(gameTeam?.teamId)
      const team = teamsById.get(teamId)
      const status = String(progress?.status || 'not_started').toLowerCase()
      const endingId = toStringId(progress?.currentEndingId)
      const durationSeconds = toDurationSeconds(progress)

      return {
        teamId: showNames ? teamId : null,
        teamName: showNames
          ? String(team?.name || '').trim() || 'Без названия'
          : `${game?.participationMode === 'player' ? 'Игрок' : 'Команда'} #${index + 1}`,
        status,
        score: Number(progress?.score) || 0,
        durationSeconds,
        usedCluesCount: Array.isArray(progress?.usedClueIds)
          ? progress.usedClueIds.length
          : 0,
        completedNodesCount: Array.isArray(progress?.completedNodeIds)
          ? progress.completedNodeIds.length
          : 0,
        ending: endingId
          ? { id: endingId, title: endingTitles.get(endingId) || '' }
          : null,
        startedAt: toDate(progress?.startedAt)?.toISOString() || null,
        finishedAt: toDate(progress?.finishedAt)?.toISOString() || null,
      }
    })

  const started = entries.filter((entry) => entry.status !== 'not_started')
  const finished = entries.filter((entry) => TERMINAL_STATUSES.has(entry.status))
  const completed = finished.filter((entry) => entry.status === 'completed')
  const failed = finished.filter((entry) => entry.status === 'failed')
  const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 100)

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      registeredCount: entries.length,
      startedCount: started.length,
      finishedCount: finished.length,
      completedCount: completed.length,
      failedCount: failed.length,
      completionRate:
        started.length > 0
          ? Math.round((completed.length / started.length) * 1000) / 10
          : 0,
      averageDurationSeconds: average(
        finished.map((entry) => entry.durationSeconds),
      ),
      averageScore: average(finished.map((entry) => entry.score)),
      averageCluesCount: average(
        finished.map((entry) => entry.usedCluesCount),
      ),
    },
    records: {
      bestScore: rankRecords(completed, compareScoreRecords, safeLimit),
      fastestCompletion: rankRecords(
        completed.filter((entry) => Number.isFinite(entry.durationSeconds)),
        compareFastestRecords,
        safeLimit,
      ),
      leastClues: rankRecords(completed, compareClueRecords, safeLimit),
    },
  }
}

export default buildStoryRecords
