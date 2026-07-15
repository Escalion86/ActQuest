import { randomUUID } from 'node:crypto'

const DEFAULT_LEASE_MS = 15_000
const DEFAULT_WAIT_MS = 3_000
const DEFAULT_POLL_MS = 50

const wait = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds))

const toLeanResult = async (query) => {
  if (query && typeof query.lean === 'function') {
    return query.lean()
  }
  return query
}

/**
 * Короткая распределённая блокировка прогресса одной команды.
 * MongoDB атомарно выдаёт её только одному запросу; истечение lease не позволяет
 * аварийно завершившемуся процессу надолго заблокировать ввод кодов.
 */
export const acquireGameProcessLock = async ({
  GamesTeams,
  teamId,
  leaseMs = DEFAULT_LEASE_MS,
  waitMs = DEFAULT_WAIT_MS,
  pollMs = DEFAULT_POLL_MS,
}) => {
  const token = randomUUID()
  const deadline = Date.now() + Math.max(waitMs, 0)

  do {
    const now = new Date()
    const expiresAt = new Date(now.getTime() + Math.max(leaseMs, 1_000))
    const query = GamesTeams.findOneAndUpdate(
      {
        _id: teamId,
        $or: [
          { 'gameProcessLock.expiresAt': { $exists: false } },
          { 'gameProcessLock.expiresAt': null },
          { 'gameProcessLock.expiresAt': { $lte: now } },
        ],
      },
      {
        $set: {
          gameProcessLock: {
            token,
            acquiredAt: now,
            expiresAt,
          },
        },
      },
      { returnDocument: 'after' },
    )

    const gameTeam = await toLeanResult(query)
    if (gameTeam) {
      return { acquired: true, token, gameTeam }
    }

    if (Date.now() >= deadline) break
    await wait(Math.min(Math.max(pollMs, 10), Math.max(deadline - Date.now(), 0)))
  } while (Date.now() <= deadline)

  return { acquired: false, token: null, gameTeam: null }
}

export const releaseGameProcessLock = async ({ GamesTeams, teamId, token }) => {
  if (!token) return

  await GamesTeams.updateOne(
    {
      _id: teamId,
      'gameProcessLock.token': token,
    },
    { $unset: { gameProcessLock: 1 } },
  )
}

export const didGameProcessStepChange = (expectedStep, currentStep) =>
  Number.isInteger(expectedStep) &&
  Number.isInteger(currentStep) &&
  expectedStep !== currentStep
