import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildLinearTaskSequence,
  buildTaskSequenceFromTemplate,
  formatTaskDistributionTemplate,
  getLockedTaskSequencePrefix,
  getTaskDistributionStartErrors,
  getTaskIndexForStep,
  getTeamTaskSequence,
  isValidTaskSequence,
  mergeTaskSequenceWithLockedPrefix,
  moveTaskInDistributionTemplate,
  normalizeTaskDistributionMode,
  normalizeStoredTaskDistributionTemplate,
  normalizeTaskDistributionTemplate,
  removeTaskFromDistributionTemplate,
  taskHasProgress,
  validateTaskDistributionTemplate,
} from '../helpers/taskDistribution.js'
import normalizeGameForCabinet from '../helpers/normalizeGameForCabinet.js'

test('normalizes mixed UI template to zero-based blocks', () => {
  assert.deepEqual(
    normalizeTaskDistributionTemplate([[1, 2, 3], [4, 5], 6, [7, 8]], 8),
    [[0, 1, 2], [3, 4], [5], [6, 7]],
  )
})

test('normalizes stored zero-based template without shifting valid indexes', () => {
  assert.deepEqual(normalizeStoredTaskDistributionTemplate([[0, 1]], 2), [[0, 1]])
})

test('drops invalid stored zero-based template values without coercing them to zero', () => {
  assert.deepEqual(
    normalizeStoredTaskDistributionTemplate(
      [[null, '', false, undefined, '0']],
      2,
    ),
    [[0]],
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

test('removes task from distribution block without removing the block', () => {
  assert.deepEqual(
    removeTaskFromDistributionTemplate([[0], [1, 2]], 0),
    [[], [1, 2]],
  )
})

test('moves task between distribution blocks without duplicating it', () => {
  assert.deepEqual(
    moveTaskInDistributionTemplate({
      template: [[0, 1], [2]],
      taskIndex: 1,
      toBlockIndex: 1,
    }),
    [[0], [2, 1]],
  )
})

test('moves task to a specific position inside distribution block', () => {
  assert.deepEqual(
    moveTaskInDistributionTemplate({
      template: [[0, 1, 2], [3]],
      taskIndex: 2,
      toBlockIndex: 0,
      toItemIndex: 0,
    }),
    [[2, 0, 1], [3]],
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

test('reports normalized out-of-range UI task number above tasks count', () => {
  const result = validateTaskDistributionTemplate(
    normalizeTaskDistributionTemplate([[9]], 8),
    8,
  )

  assert.deepEqual(result.outOfRangeTaskNumbers, [9])
  assert.match(result.messages.join('\n'), /несуществующие задания: 9/)
})

test('reports normalized zero UI task number as invalid without treating it as task 1', () => {
  const result = validateTaskDistributionTemplate(
    normalizeTaskDistributionTemplate([[0]], 8),
    8,
  )

  assert.deepEqual(result.outOfRangeTaskNumbers, [0])
  assert.match(result.messages.join('\n'), /несуществующие задания: 0/)
  assert.deepEqual(result.duplicateTaskNumbers, [])
  assert.deepEqual(result.missingTaskNumbers, [1, 2, 3, 4, 5, 6, 7, 8])
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

test('merges generated sequence without moving locked prefix tasks', () => {
  assert.deepEqual(
    mergeTaskSequenceWithLockedPrefix([1, 3, 2, 0], [2, 0]),
    [2, 0, 1, 3],
  )
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

test('blocks random game start until every team has a valid sequence', () => {
  const game = {
    tasks: [{}, {}, {}],
    taskDistributionMode: 'random',
  }

  assert.deepEqual(
    getTaskDistributionStartErrors(game, [
      { taskSequence: [2, 0, 1] },
      { taskSequence: [0, 1] },
    ]),
    ['Сначала распределите задания для команды.'],
  )
  assert.deepEqual(
    getTaskDistributionStartErrors(game, [
      { taskSequence: [2, 0, 1] },
      { taskSequence: [1, 2, 0] },
    ]),
    [],
  )
  assert.deepEqual(
    getTaskDistributionStartErrors(
      { tasks: [{}, {}, {}], taskDistributionMode: 'linear' },
      [{ taskSequence: [] }],
    ),
    [],
  )
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

test('normalizes game distribution fields for cabinet', () => {
  const game = normalizeGameForCabinet({
    _id: 'game-1',
    name: 'Game',
    type: 'classic',
    tasks: [{ title: 'A' }, { title: 'B' }],
    taskDistributionMode: 'random',
    taskDistributionTemplate: [[0, 1]],
  })

  assert.equal(game.taskDistributionMode, 'random')
  assert.deepEqual(game.taskDistributionTemplate, [[0, 1]])
})

test('random template must cover every task exactly once', () => {
  const normalized = normalizeTaskDistributionTemplate([[1, 2], [4]], 4)
  const result = validateTaskDistributionTemplate(normalized, 4)

  assert.equal(result.valid, false)
  assert.deepEqual(result.missingTaskNumbers, [3])
})
