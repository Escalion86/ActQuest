import test from 'node:test'
import assert from 'node:assert/strict'

import {
  PREQUEL_STATUS_COMPLETED,
  PREQUEL_STATUS_LOCKED,
  PREQUEL_STATUS_OPEN,
  resolveDefaultPrequelForDate,
  resolvePrequelStatusForDate,
} from '../helpers/normalizePrequel.js'
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

test('main codes complete only the selected prequel and apply completion bonus once', () => {
  const game = {
    prequels: [
      {
        id: 'first',
        title: 'Первый',
        enabled: true,
        mode: 'single_hit',
        mainCodes: [
          { id: 'm1', code: 'ONE' },
          { id: 'm2', code: 'TWO' },
        ],
        requiredMainCodesCount: 2,
        completionBonus: { value: 45, description: 'За выполнение' },
        bonusCodes: [{ id: 'b1', code: 'SIDE', value: 5 }],
      },
      {
        id: 'second',
        title: 'Второй',
        enabled: true,
        bonusCodes: [{ id: 'b2', code: 'OTHER', value: 10 }],
      },
    ],
  }

  const side = applyPrequelSubmission({
    game,
    gameTeam: { prequelProgresses: [] },
    prequelId: 'first',
    code: 'SIDE',
  })
  assert.equal(side.ok, true)
  assert.equal(side.progress.completedAt, null)

  const firstMain = applyPrequelSubmission({
    game,
    gameTeam: { prequelProgresses: [side.progress] },
    prequelId: 'first',
    code: 'ONE',
  })
  assert.equal(firstMain.progress.completedAt, null)

  const secondMain = applyPrequelSubmission({
    game,
    gameTeam: { prequelProgresses: [firstMain.progress] },
    prequelId: 'first',
    code: 'TWO',
  })
  assert.equal(secondMain.completed, true)
  assert.ok(secondMain.progress.completedAt)
  assert.equal(
    secondMain.progress.appliedAdjustments.filter(
      (item) => item.source === 'completion_bonus',
    ).length,
    1,
  )
})

test('manual completion works without main codes and applies bonus', () => {
  const result = applyPrequelSubmission({
    game: {
      prequels: [
        {
          id: 'manual',
          enabled: true,
          completionBonus: { value: 30 },
        },
      ],
    },
    gameTeam: { prequelProgresses: [] },
    prequelId: 'manual',
    manualComplete: true,
    actorUserId: 'admin-id',
  })

  assert.equal(result.ok, true)
  assert.equal(result.progress.completedSource, 'manual')
  assert.equal(result.progress.completedByUserId, 'admin-id')
  assert.equal(result.progress.appliedAdjustments[0].value, 30)
})

test('default prequel selection prefers an already opened prequel', () => {
  const selected = resolveDefaultPrequelForDate(
    [
      {
        id: 'future',
        enabled: true,
        openAt: '2026-08-01T14:00:00.000Z',
        description: 'Откроется позже',
        mainCodes: [{ id: 'future-code', code: 'FUTURE' }],
      },
      {
        id: 'opened',
        enabled: true,
        openAt: '2026-07-01T14:00:00.000Z',
        description: 'Уже открыт',
        mainCodes: [{ id: 'opened-code', code: 'OPENED' }],
      },
    ],
    new Date('2026-07-15T14:00:00.000Z'),
  )

  assert.equal(selected?.id, 'opened')
})

test('prequel status distinguishes locked, open and completed states', () => {
  const prequel = {
    id: 'status-test',
    enabled: true,
    openAt: '2026-08-01T14:00:00.000Z',
    description: 'Проверка статуса',
    mainCodes: [{ id: 'status-code', code: 'STATUS' }],
  }

  assert.equal(
    resolvePrequelStatusForDate(
      prequel,
      null,
      new Date('2026-07-15T14:00:00.000Z'),
    ),
    PREQUEL_STATUS_LOCKED,
  )
  assert.equal(
    resolvePrequelStatusForDate(
      { ...prequel, openAt: '2026-07-01T14:00:00.000Z' },
      null,
      new Date('2026-07-15T14:00:00.000Z'),
    ),
    PREQUEL_STATUS_OPEN,
  )
  assert.equal(
    resolvePrequelStatusForDate(
      prequel,
      { completedAt: '2026-07-10T14:00:00.000Z' },
      new Date('2026-07-15T14:00:00.000Z'),
    ),
    PREQUEL_STATUS_COMPLETED,
  )
})
