import {
  acquireGameProcessLock, releaseGameProcessLock,
  guardGameProgressModel, gameProgressConflict,
} from './gameProcessLock.js'

// Старт и остановка удерживают те же блокировки, что ввод и автопереходы.
// Отдельная блокировка игры исключает два одновременных старта/остановки.
export default async function withGameTeamsLocked({ db, gameId }, callback) {
  const Games = db.model('Games')
  const GamesTeams = db.model('GamesTeams')
  const held = []
  const leaseMs = 120_000
  let lost = false
  let renewing = Promise.resolve()
  const renew = async () => {
    for (const { model, lock } of [...held]) {
      const now = new Date()
      const result = await model.updateOne({
        _id: lock.gameTeam._id,
        'gameProcessLock.token': lock.token,
        'gameProcessLock.expiresAt': { $gt: now },
      }, { $set: { 'gameProcessLock.expiresAt': new Date(now.getTime() + leaseMs) } })
      if (result.matchedCount !== 1) lost = true
    }
    if (lost) throw gameProgressConflict()
  }
  const timer = setInterval(() => {
    renewing = renewing.then(renew).catch(() => { lost = true })
  }, 20_000)
  timer.unref?.()
  try {
    const gameLock = await acquireGameProcessLock({ GamesTeams: Games, teamId: gameId, leaseMs })
    if (!gameLock.acquired) throw gameProgressConflict()
    held.push({ model: Games, lock: gameLock })
    const registrations = await GamesTeams.find({ gameId: String(gameId) }).lean()
    const acquired = await Promise.allSettled(registrations.map(async (team) => {
      const lock = await acquireGameProcessLock({ GamesTeams, teamId: team._id, leaseMs })
      if (!lock.acquired) throw gameProgressConflict()
      held.push({ model: GamesTeams, lock })
      return lock
    }))
    if (acquired.some((item) => item.status === 'rejected')) throw gameProgressConflict()
    const locks = acquired.map((item) => item.value)
    const assertHeld = async () => {
      await renewing
      await renew()
    }
    await assertHeld()
    return await callback({
      game: gameLock.gameTeam,
      teams: locks.map((lock) => lock.gameTeam),
      Games: guardGameProgressModel(Games, gameLock),
      teamModel: (id) => {
        const lock = locks.find((item) => String(item.gameTeam._id) === String(id))
        if (!lock) throw gameProgressConflict()
        return guardGameProgressModel(GamesTeams, lock)
      },
      assertHeld,
    })
  } finally {
    clearInterval(timer)
    await renewing
    await Promise.allSettled(held.map(({ model, lock }) => releaseGameProcessLock({
      GamesTeams: model, teamId: lock.gameTeam._id, token: lock.token,
    })))
  }
}
