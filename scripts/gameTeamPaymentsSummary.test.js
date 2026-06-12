import test from 'node:test'
import assert from 'node:assert/strict'

import { buildGameTeamPaymentsSummary } from '../server/gameTeamPaymentsSummary.js'

test('buildGameTeamPaymentsSummary joins registered teams with completed payments', () => {
  const summary = buildGameTeamPaymentsSummary({
    gameTeams: [
      { _id: 'game-team-1', teamId: 'team-1', paidGame: true },
      { _id: 'game-team-2', teamId: 'team-2', paidGame: false },
    ],
    teams: [
      {
        _id: 'team-1',
        name: 'Комета',
        members: [{ userId: 'user-1', name: 'Иван', phone: '+79990000001' }],
      },
      { _id: 'team-2', name: 'Феникс', members: [] },
    ],
    paymentTotals: [
      { _id: 'game-team-1', totalPaid: 2500, transactionsCount: 2 },
      { _id: 'game-team-2', totalPaid: 0, transactionsCount: 0 },
    ],
  })

  assert.equal(summary.totalPaid, 2500)
  assert.deepEqual(summary.teams, [
    {
      gameTeamId: 'game-team-1',
      teamId: 'team-1',
      teamName: 'Комета',
      paidGame: true,
      totalPaid: 2500,
      transactionsCount: 2,
      members: [{ userId: 'user-1', name: 'Иван', phone: '+79990000001' }],
    },
    {
      gameTeamId: 'game-team-2',
      teamId: 'team-2',
      teamName: 'Феникс',
      paidGame: false,
      totalPaid: 0,
      transactionsCount: 0,
      members: [],
    },
  ])
})
