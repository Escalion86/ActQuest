import assert from 'node:assert/strict'

import {
  acquireGameProcessLock,
  didGameProcessStepChange,
  releaseGameProcessLock,
} from '../server/gameProcessLock.js'

const wait = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds))

class InMemoryGamesTeams {
  constructor() {
    this.lastFindOneAndUpdateOptions = null
    this.document = {
      _id: 'game-team-1',
      activeNum: 0,
      findedCodes: [[]],
      gameProcessLock: null,
    }
  }

  findOneAndUpdate(filter, update, options) {
    this.lastFindOneAndUpdateOptions = options
    return {
      lean: async () => {
        const lock = this.document.gameProcessLock
        const now = filter.$or[2]['gameProcessLock.expiresAt'].$lte
        const lockIsAvailable = !lock?.expiresAt || lock.expiresAt <= now

        if (filter._id !== this.document._id || !lockIsAvailable) return null

        this.document.gameProcessLock = {
          ...update.$set.gameProcessLock,
        }
        return structuredClone(this.document)
      },
    }
  }

  async updateOne(filter) {
    if (
      filter._id === this.document._id &&
      filter['gameProcessLock.token'] === this.document.gameProcessLock?.token
    ) {
      this.document.gameProcessLock = null
      return { modifiedCount: 1 }
    }
    return { modifiedCount: 0 }
  }
}

const GamesTeams = new InMemoryGamesTeams()

const firstLock = await acquireGameProcessLock({
  GamesTeams,
  teamId: 'game-team-1',
  waitMs: 0,
})
assert.equal(firstLock.acquired, true)
assert.deepEqual(GamesTeams.lastFindOneAndUpdateOptions, {
  returnDocument: 'after',
})

const blockedLock = await acquireGameProcessLock({
  GamesTeams,
  teamId: 'game-team-1',
  waitMs: 20,
  pollMs: 10,
})
assert.equal(blockedLock.acquired, false)

await releaseGameProcessLock({
  GamesTeams,
  teamId: 'game-team-1',
  token: 'foreign-token',
})
assert.equal(GamesTeams.document.gameProcessLock.token, firstLock.token)

await releaseGameProcessLock({
  GamesTeams,
  teamId: 'game-team-1',
  token: firstLock.token,
})

const appendCode = async (code, processingDelay) => {
  const lock = await acquireGameProcessLock({
    GamesTeams,
    teamId: 'game-team-1',
    waitMs: 500,
    pollMs: 10,
  })
  assert.equal(lock.acquired, true)

  const codes = [...lock.gameTeam.findedCodes[0]]
  await wait(processingDelay)
  GamesTeams.document.findedCodes[0] = [...codes, code]

  await releaseGameProcessLock({
    GamesTeams,
    teamId: 'game-team-1',
    token: lock.token,
  })
}

await Promise.all([appendCode('first', 40), appendCode('second', 0)])
assert.deepEqual(GamesTeams.document.findedCodes[0], ['first', 'second'])

GamesTeams.document.gameProcessLock = {
  token: 'expired-token',
  acquiredAt: new Date(Date.now() - 20_000),
  expiresAt: new Date(Date.now() - 1_000),
}
const recoveredLock = await acquireGameProcessLock({
  GamesTeams,
  teamId: 'game-team-1',
  waitMs: 0,
})
assert.equal(recoveredLock.acquired, true)
assert.notEqual(recoveredLock.token, 'expired-token')
await releaseGameProcessLock({
  GamesTeams,
  teamId: 'game-team-1',
  token: recoveredLock.token,
})

assert.equal(didGameProcessStepChange(2, 2), false)
assert.equal(didGameProcessStepChange(2, 3), true)

console.log('[test:game-process-lock] OK')
