import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildGameTasksStats,
  buildGameTaskCountLabel,
  getVisibleGameTaskCounts,
} from '../helpers/gameTaskCounts.js'

test('game task counts are hidden when the setting is disabled', () => {
  assert.equal(
    getVisibleGameTaskCounts({
      showTasksCountInGame: false,
      tasks: [{ isBonusTask: false }, { isBonusTask: true }],
    }),
    null,
  )
})

test('game task counts include active main and bonus tasks when enabled', () => {
  assert.deepEqual(
    getVisibleGameTaskCounts({
      showTasksCountInGame: true,
      tasks: [
        { isBonusTask: false },
        { isBonusTask: true },
        { isBonusTask: true, canceled: true },
        { canceled: true },
      ],
    }),
    { main: 1, bonus: 1 },
  )
})

test('game task count label includes bonus tasks only when present', () => {
  assert.equal(buildGameTaskCountLabel({ main: 3, bonus: 0 }), '3')
  assert.equal(buildGameTaskCountLabel({ main: 3, bonus: 2 }), '3 + 2 бонусных')
})

test('game task counts can use precomputed stats when tasks are hidden', () => {
  const tasks = [
    { isBonusTask: false },
    { isBonusTask: true },
    { isBonusTask: false, canceled: true },
  ]

  assert.deepEqual(buildGameTasksStats(tasks), {
    total: 1,
    bonus: 1,
    canceled: 1,
  })
  assert.deepEqual(
    getVisibleGameTaskCounts({
      showTasksCountInGame: true,
      tasks: [],
      tasksStats: buildGameTasksStats(tasks),
    }),
    { main: 1, bonus: 1 },
  )
})
