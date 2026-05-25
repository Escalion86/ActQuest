import test from 'node:test'
import assert from 'node:assert/strict'

import applyPrequelSubmission from '../server/applyPrequelSubmission.js'

const buildGame = (overrides = {}) => ({
  prequel: {
    enabled: true,
    mode: 'multi_hit',
    bonusCodes: [{ id: 'b1', code: 'BONUS', value: 30, description: 'Бонус' }],
    penaltyCodes: [{ id: 'p1', code: 'PENALTY', value: 15, description: 'Штраф' }],
    wrongAttemptsLimit: 2,
    wrongAttemptsPenalty: 7,
    wrongAttemptsStoryEffects: [],
    ...overrides,
  },
})

test('applyPrequelSubmission accepts bonus code once and rejects duplicate', () => {
  const first = applyPrequelSubmission({
    game: buildGame(),
    gameTeam: { prequelProgress: null },
    code: 'bonus',
    now: new Date('2026-05-26T00:00:00.000Z'),
  })

  assert.equal(first.ok, true)
  assert.equal(first.progress.foundBonusCodes.length, 1)
  assert.equal(first.progress.appliedAdjustments[0].type, 'bonus')
  assert.equal(first.progress.appliedAdjustments[0].value, 30)

  const duplicate = applyPrequelSubmission({
    game: buildGame(),
    gameTeam: { prequelProgress: first.progress },
    code: 'BONUS',
    now: new Date('2026-05-26T00:01:00.000Z'),
  })

  assert.equal(duplicate.ok, false)
  assert.equal(duplicate.status, 409)
})

test('applyPrequelSubmission applies repeated wrong-attempt penalties by limit', () => {
  let progress = null

  for (const [index, code] of ['x1', 'x2', 'x3', 'x4'].entries()) {
    const result = applyPrequelSubmission({
      game: buildGame(),
      gameTeam: { prequelProgress: progress },
      code,
      now: new Date(`2026-05-26T00:0${index}:00.000Z`),
    })
    assert.equal(result.ok, true)
    progress = result.progress
  }

  assert.equal(progress.wrongCodes.length, 4)
  assert.equal(progress.wrongPenaltyAppliedCount, 2)
  const wrongPenaltyItems = progress.appliedAdjustments.filter(
    (item) => item.source === 'wrong_attempts_limit',
  )
  assert.equal(wrongPenaltyItems.length, 2)
  assert.equal(
    wrongPenaltyItems.reduce((sum, item) => sum + item.value, 0),
    14,
  )
})

test('applyPrequelSubmission closes single-hit prequel after first matched code', () => {
  const game = buildGame({ mode: 'single_hit' })
  const first = applyPrequelSubmission({
    game,
    gameTeam: { prequelProgress: null },
    code: 'penalty',
    now: new Date('2026-05-26T01:00:00.000Z'),
  })

  assert.equal(first.ok, true)
  assert.equal(first.progress.isClosed, true)

  const second = applyPrequelSubmission({
    game,
    gameTeam: { prequelProgress: first.progress },
    code: 'bonus',
    now: new Date('2026-05-26T01:01:00.000Z'),
  })

  assert.equal(second.ok, false)
  assert.equal(second.status, 409)
})
