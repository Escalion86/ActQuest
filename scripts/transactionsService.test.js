import test from 'node:test'
import assert from 'node:assert/strict'

import { buildTransactionPayload } from '../server/transactionsService.js'

test('buildTransactionPayload keeps team payment fields', () => {
  const payload = buildTransactionPayload({
    direction: 'income',
    amount: '1500',
    paymentMethod: 'transfer',
    status: 'completed',
    userId: 'user-1',
    gameId: 'game-1',
    teamId: 'team-1',
    gameTeamId: 'game-team-1',
    paidAt: '2026-06-12T10:30:00.000Z',
  })

  assert.equal(payload.teamId, 'team-1')
  assert.equal(payload.gameTeamId, 'game-team-1')
  assert.equal(payload.paidAt.toISOString(), '2026-06-12T10:30:00.000Z')
  assert.equal(payload.amount, 1500)
})

test('buildTransactionPayload does not affect user balance for team payments by default', () => {
  const payload = buildTransactionPayload({
    direction: 'income',
    amount: 1500,
    paymentMethod: 'cash',
    status: 'completed',
    userId: 'user-1',
    gameId: 'game-1',
    teamId: 'team-1',
    gameTeamId: 'game-team-1',
  })

  assert.equal(payload.userBalanceDelta, 0)
})

test('buildTransactionPayload accepts discount without affecting user balance', () => {
  const payload = buildTransactionPayload({
    direction: 'expense',
    amount: 500,
    paymentMethod: 'discount',
    status: 'completed',
    userId: 'user-1',
    gameId: 'game-1',
  })

  assert.equal(payload.paymentMethod, 'discount')
  assert.equal(payload.direction, 'income')
  assert.equal(payload.amount, 500)
  assert.equal(payload.userBalanceDelta, 0)
})
