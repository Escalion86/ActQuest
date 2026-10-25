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

export const gameProgressConflict = () => Object.assign(
  new Error('Состояние игры изменилось или блокировка истекла. Обновите экран.'),
  { statusCode: 409 },
)

// Проверка владельца входит в саму запись MongoDB: истёкшая блокировка
// не позволяет старому запросу затереть результат нового владельца.
export const guardGameProgressModel = (model, lock) => new Proxy(model, {
  get(target, key) {
    if (key === 'findByIdAndUpdate') return (id, update, options = {}) => {
      if (String(id) !== String(lock.gameTeam._id)) throw gameProgressConflict()
      let promise
      const execute = (lean = false) => {
        if (!promise) {
          const query = target.findOneAndUpdate({
            _id: id,
            'gameProcessLock.token': lock.token,
            'gameProcessLock.expiresAt': { $gt: new Date() },
          }, update, options)
          promise = Promise.resolve(lean ? query.lean() : query)
            .then((result) => {
              if (!result) throw gameProgressConflict()
              return result
            })
        }
        return promise
      }
      return {
        lean: () => execute(true),
        then: (resolve, reject) => execute().then(resolve, reject),
      }
    }
    const value = Reflect.get(target, key)
    return typeof value === 'function' ? value.bind(target) : value
  },
})

// Тестовые прогоны используют свой снимок; реальные команды перечитывают
// статус только после захвата блокировки, в том числе после ожидания СТОП.
export const refreshProgressGame = async (model, game) => {
  if (model.modelName !== 'GamesTeams' || !model.db) return game
  const current = await model.db.model('Games').findById(game._id).lean()
  if (!current) throw gameProgressConflict()
  return current
}
