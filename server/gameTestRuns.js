import { toStringId } from '@helpers/idAndDate'

const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/

export const normalizeTestRunId = (value) => {
  const normalized = toStringId(value)
  return OBJECT_ID_RE.test(normalized) ? normalized : ''
}

export const normalizeTestIdentity = ({ userId, telegramId } = {}) => ({
  userId: toStringId(userId),
  telegramId:
    telegramId !== null && telegramId !== undefined
      ? String(telegramId).trim()
      : '',
})

export const isTestRunOwner = ({ run, userId, telegramId }) => {
  if (!run) return false

  const identity = normalizeTestIdentity({ userId, telegramId })
  const ownerUserId = toStringId(run.ownerUserId)
  const ownerTelegramId =
    run.ownerTelegramId !== null && run.ownerTelegramId !== undefined
      ? String(run.ownerTelegramId).trim()
      : ''

  return Boolean(
    (identity.userId && ownerUserId && identity.userId === ownerUserId) ||
      (identity.telegramId &&
        ownerTelegramId &&
        identity.telegramId === ownerTelegramId),
  )
}

export const buildTestGameSnapshot = (game, now = new Date()) => {
  const source = game?.toObject?.() || game || {}

  return {
    ...source,
    _id: toStringId(source._id),
    id: toStringId(source._id),
    status: 'started',
    dateStartFact: now,
    dateEndFact: null,
    hidden: true,
    isRated: false,
    runtimeMode: 'test',
    result: null,
  }
}

export const buildTestGameFromRun = (run) => {
  const source = run?.gameSnapshot?.toObject?.() || run?.gameSnapshot || {}
  const gameId = toStringId(run?.gameId) || toStringId(source?._id)

  return {
    ...source,
    _id: gameId,
    id: gameId,
    status: 'started',
    hidden: true,
    isRated: false,
    runtimeMode: 'test',
    result: null,
  }
}

export const buildTestTeamFromRun = (run) => ({
  _id: toStringId(run?.teamId) || toStringId(run?._id),
  name: 'Тестовая команда',
  description: 'Изолированный тестовый прогон администратора',
  location: run?.gameSnapshot?.location || null,
  open: false,
  runtimeMode: 'test',
})

export const loadOwnedTestRun = async ({
  GameTestRuns,
  testRunId,
  gameId,
  userId,
  telegramId,
}) => {
  const normalizedRunId = normalizeTestRunId(testRunId)
  if (!normalizedRunId) return null

  const run = await GameTestRuns.findById(normalizedRunId).lean()
  if (!run?._id) return null
  if (gameId && toStringId(run.gameId) !== toStringId(gameId)) return null
  if (!isTestRunOwner({ run, userId, telegramId })) return null
  if (run.expiresAt && new Date(run.expiresAt).getTime() <= Date.now()) return null

  return run
}
