import test from 'node:test'
import assert from 'node:assert/strict'
import { loader } from './copyGameTasks.fixture.mjs'

for (const mode of ['random', 'linear']) {
  test(`Game Control сохраняет режим ${mode} при чтении игры из БД`, async () => {
    const game = { _id: '111111111111111111111111', type: 'classic', status: 'started', taskDistributionMode: mode, tasks: [] }
    const query = value => ({
      select: projection => query(Object.fromEntries(Object.entries(value).filter(([key]) => key === '_id' || projection[key]))),
      lean: async () => value,
    })
    const db = { model: name => name === 'Games'
      ? { findById: () => query(game) }
      : { find: () => query([]) } }
    const load = loader({
      'next/server': { NextResponse: Response },
      'next-auth': { getServerSession: async () => ({ user: { role: 'dev' } }) },
      '@server/auth/authOptions': { authOptions: {} },
      '@utils/dbConnectGlobal': async () => db,
      '@server/gameTeamMessages': { fetchUnreadTeamMessageCounts: async () => ({}) },
      '@server/agentNotifications': { notifyAgentsForGameTeamProgress: async () => {} },
    })
    const { GET } = load('@app/api/cabinet/admin/game-status/route')
    const response = await GET(new Request(`http://localhost/api/cabinet/admin/game-status?gameId=${game._id}`))
    assert.equal(response.status, 200)
    const json = await response.json()
    assert.equal(json.success, true)
    assert.equal(json.data.taskDistributionMode, mode)
  })
}
