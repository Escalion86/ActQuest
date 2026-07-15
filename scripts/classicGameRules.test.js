import test from 'node:test'
import assert from 'node:assert/strict'

import {
  canMutateClassicGameProgress,
  getClassicTaskMutationBlockReason,
  getRequiredMainCodesValidationError,
  normalizeClassicCode,
  resolveForceClueCost,
  resolveRequiredMainCodesCount,
} from '../helpers/classicGameRules.js'

test('normalizes classic codes for case-insensitive matching', () => {
  assert.equal(normalizeClassicCode('  AbC-123  '), 'abc-123')
})

test('resolves only a valid integer required main codes count', () => {
  const task = { codes: ['ONE', 'TWO', 'THREE'] }

  assert.equal(resolveRequiredMainCodesCount(task), 3)
  assert.equal(
    resolveRequiredMainCodesCount({ ...task, numCodesToCompliteTask: 2 }),
    2,
  )

  for (const invalidValue of [0, -1, 1.5, 4, 'wrong']) {
    assert.equal(
      resolveRequiredMainCodesCount({
        ...task,
        numCodesToCompliteTask: invalidValue,
      }),
      3,
    )
  }
})

test('reports invalid required main codes settings before game start', () => {
  const task = { codes: ['ONE', 'TWO'] }

  assert.equal(getRequiredMainCodesValidationError(task), null)
  assert.equal(
    getRequiredMainCodesValidationError({
      ...task,
      numCodesToCompliteTask: 1,
    }),
    null,
  )
  assert.match(
    getRequiredMainCodesValidationError({
      ...task,
      numCodesToCompliteTask: 0,
    }),
    /не меньше 1/,
  )
  assert.match(
    getRequiredMainCodesValidationError({
      ...task,
      numCodesToCompliteTask: 1.5,
    }),
    /целым числом/,
  )
  assert.match(
    getRequiredMainCodesValidationError({
      ...task,
      numCodesToCompliteTask: 3,
    }),
    /не может быть больше/,
  )
})

test('uses configured fixed penalty or remaining clue time by mode', () => {
  assert.deepEqual(
    resolveForceClueCost({
      mode: 'penalty',
      configuredPenaltySeconds: 300,
      secondsUntilNextClue: 900,
    }),
    { mode: 'penalty', seconds: 300 },
  )
  assert.deepEqual(
    resolveForceClueCost({
      mode: 'time',
      configuredPenaltySeconds: 300,
      secondsUntilNextClue: 900,
    }),
    { mode: 'time', seconds: 900 },
  )
})

test('allows classic progress mutations only while game is started', () => {
  assert.equal(canMutateClassicGameProgress('started'), true)
  for (const status of ['active', 'finished', 'closed', 'canceled']) {
    assert.equal(canMutateClassicGameProgress(status), false)
  }
})

test('blocks codes for completed failed and timed-out tasks', () => {
  const now = new Date('2026-07-15T12:10:00.000Z')
  const task = { _id: 'task-1', codes: ['CODE'] }
  const game = { taskDuration: 600 }
  const baseTeam = {
    startTime: [new Date('2026-07-15T12:01:00.000Z')],
    endTime: [null],
    taskFailures: [],
    timeAddings: [],
  }

  assert.equal(
    getClassicTaskMutationBlockReason({
      game,
      gameTeam: { ...baseTeam, startTime: [] },
      task,
      taskIndex: 0,
      now,
    }),
    'not_started',
  )
  assert.equal(
    getClassicTaskMutationBlockReason({
      game,
      gameTeam: baseTeam,
      task,
      taskIndex: 0,
      now,
    }),
    null,
  )
  assert.equal(
    getClassicTaskMutationBlockReason({
      game,
      gameTeam: { ...baseTeam, endTime: [now] },
      task,
      taskIndex: 0,
      now,
    }),
    'completed',
  )
  assert.equal(
    getClassicTaskMutationBlockReason({
      game,
      gameTeam: {
        ...baseTeam,
        taskFailures: [{ taskIndex: 0, failedAt: now }],
      },
      task,
      taskIndex: 0,
      now,
    }),
    'failed',
  )
  assert.equal(
    getClassicTaskMutationBlockReason({
      game,
      gameTeam: {
        ...baseTeam,
        startTime: [new Date('2026-07-15T12:00:00.000Z')],
      },
      task,
      taskIndex: 0,
      now,
    }),
    'timeout',
  )
})

test('counts captain clue time when checking task timeout', () => {
  const now = new Date('2026-07-15T12:08:00.000Z')
  const task = { _id: 'task-1', codes: ['CODE'] }
  const gameTeam = {
    startTime: [new Date('2026-07-15T12:00:00.000Z')],
    endTime: [null],
    taskFailures: [],
    timeAddings: [
      {
        source: 'captain_force_clue',
        taskId: 'task-1',
        taskIndex: 0,
        time: 120,
      },
    ],
  }

  assert.equal(
    getClassicTaskMutationBlockReason({
      game: { taskDuration: 600 },
      gameTeam,
      task,
      taskIndex: 0,
      now,
    }),
    'timeout',
  )
})
