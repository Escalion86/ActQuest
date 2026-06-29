import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildLinearTaskSequence,
  buildTaskSequenceFromTemplate,
  formatTaskDistributionTemplate,
  getLockedTaskSequencePrefix,
  getTaskIndexForStep,
  getTeamTaskSequence,
  isValidTaskSequence,
  normalizeTaskDistributionMode,
  normalizeTaskDistributionTemplate,
  taskHasProgress,
  validateTaskDistributionTemplate,
} from '../helpers/taskDistribution.js'

test('normalizes mixed UI template to zero-based blocks', () => {
  assert.deepEqual(
    normalizeTaskDistributionTemplate([[1, 2, 3], [4, 5], 6, [7, 8]], 8),
    [[0, 1, 2], [3, 4], [5], [6, 7]],
  )
})

test('normalizes distribution mode to known values', () => {
  assert.equal(normalizeTaskDistributionMode('random'), 'random')
  assert.equal(normalizeTaskDistributionMode('linear'), 'linear')
  assert.equal(normalizeTaskDistributionMode('anything'), 'linear')
})

test('formats normalized template for cabinet UI', () => {
  assert.equal(
    formatTaskDistributionTemplate([[0, 1, 2], [3, 4], [5], [6, 7]]),
    '[1,2,3],[4,5],6,[7,8]',
  )
})

test('validates missing duplicate out-of-range and empty blocks', () => {
  const result = validateTaskDistributionTemplate([[0, 1], [], [1], [5]], 4)

  assert.equal(result.valid, false)
  assert.deepEqual(result.missingTaskNumbers, [3, 4])
  assert.deepEqual(result.duplicateTaskNumbers, [2])
  assert.deepEqual(result.outOfRangeTaskNumbers, [6])
  assert.equal(result.hasEmptyBlock, true)
  assert.match(result.messages.join('\n'), /отсутствуют задания: 3, 4/)
  assert.match(result.messages.join('\n'), /Задание 2 указано несколько раз/)
  assert.match(result.messages.join('\n'), /несуществующие задания: 6/)
  assert.match(result.messages.join('\n'), /пустой блок/)
})

test('builds sequence by shuffling inside blocks only', () => {
  const sequence = buildTaskSequenceFromTemplate(
    [[0, 1, 2], [3, 4], [5]],
    () => 0.99,
  )

  assert.deepEqual(sequence.slice(0, 3).sort((a, b) => a - b), [0, 1, 2])
  assert.deepEqual(sequence.slice(3, 5).sort((a, b) => a - b), [3, 4])
  assert.equal(sequence[5], 5)
})

test('uses team template before game template and falls back to linear', () => {
  const game = {
    tasks: [{}, {}, {}],
    taskDistributionMode: 'random',
    taskDistributionTemplate: [[0], [1], [2]],
  }

  assert.deepEqual(
    getTeamTaskSequence(game, { taskSequence: [2, 1, 0] }),
    [2, 1, 0],
  )
  assert.deepEqual(getTeamTaskSequence({ tasks: [{}, {}] }, {}), [0, 1])
  assert.deepEqual(buildLinearTaskSequence(3), [0, 1, 2])
})

test('validates task sequence exact zero-based coverage once each', () => {
  assert.equal(isValidTaskSequence([2, 0, 1], 3), true)
  assert.equal(isValidTaskSequence([0, 1, 1], 3), false)
  assert.equal(isValidTaskSequence([0, 1, 3], 3), false)
  assert.equal(isValidTaskSequence([0, '0'], 2), false)
})

test('maps active step to source task index', () => {
  const game = { tasks: [{}, {}, {}] }
  const gameTeam = { taskSequence: [2, 0, 1] }

  assert.equal(getTaskIndexForStep(game, gameTeam, 0), 2)
  assert.equal(getTaskIndexForStep(game, gameTeam, 1), 0)
  assert.equal(getTaskIndexForStep(game, gameTeam, 9), null)
})

test('locks tasks that already have progress', () => {
  assert.deepEqual(
    getLockedTaskSequencePrefix({
      taskSequence: [2, 0, 1, 3],
      startTime: [
        new Date('2026-01-01T00:00:00Z'),
        null,
        new Date('2026-01-01T00:00:00Z'),
        null,
      ],
      endTime: [null, null, null, null],
      findedCodes: [[], [], [], []],
      wrongCodes: [[], [], [], []],
      findedBonusCodes: [[], [], [], []],
      findedPenaltyCodes: [[], [], [], []],
      photos: [
        { photos: [] },
        { photos: [] },
        { photos: [] },
        { photos: [] },
      ],
      taskFailures: [],
    }),
    [2, 0],
  )
})

test('detects progress markers by source task index', () => {
  assert.equal(
    taskHasProgress(
      {
        startTime: [null, null],
        endTime: [null, null],
        findedCodes: [[], ['CODE']],
        wrongCodes: [[], []],
        findedBonusCodes: [[], []],
        findedPenaltyCodes: [[], []],
        photos: [{ photos: [] }, { photos: [] }],
        taskFailures: [],
      },
      1,
    ),
    true,
  )
  assert.equal(
    taskHasProgress(
      {
        startTime: [null],
        endTime: [null],
        findedCodes: [[]],
        wrongCodes: [[]],
        findedBonusCodes: [[]],
        findedPenaltyCodes: [[]],
        photos: [{ photos: [] }],
        taskFailures: [{ taskIndex: 0, failedAt: new Date('2026-01-01T00:00:00Z') }],
      },
      0,
    ),
    true,
  )
})
