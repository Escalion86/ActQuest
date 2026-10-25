import test from 'node:test'
import assert from 'node:assert/strict'

import buildGameStartProgressUpdate from '../server/buildGameStartProgressUpdate.js'

test('общий старт учитывает первое задание команды и единое время запуска', () => {
  const startedAt = new Date('2026-10-24T12:13:00.217Z')
  for (const taskSequence of [[1, 0, 2], [2, 0, 1], [0, 1, 2]]) {
    const result = buildGameStartProgressUpdate({
      gameTasksCount: 3, startImmediately: true, taskSequence, startedAt,
    })
    assert.equal(result.activeNum, 0)
    assert.deepEqual(result.startTime, [0, 1, 2].map((index) =>
      index === taskSequence[0] ? startedAt : null,
    ))
    assert.deepEqual(result.endTime, [null, null, null])
  }
})

test('индивидуальный старт не запускает таймер заранее', () => {
  const result = buildGameStartProgressUpdate({
    gameTasksCount: 3, startImmediately: false, taskSequence: [2, 0, 1],
  })
  assert.deepEqual(result.startTime, [])
})

test('некорректный порядок использует линейное распределение', () => {
  const startedAt = new Date('2026-10-24T12:13:00.217Z')
  for (const taskSequence of [[], [1, 1, 0], [5, 0, 1]]) {
    const result = buildGameStartProgressUpdate({
      gameTasksCount: 3, startImmediately: true, taskSequence, startedAt,
    })
    assert.deepEqual(result.startTime, [startedAt, null, null])
  }
})

test('preserves manual adjustments and removes system clue penalties on game start', () => {
  const preservedBonus = {
    id: 'manual-bonus',
    name: 'Ручной бонус',
    time: -120,
    source: 'manual_team_adjustment',
    scope: 'total_adjustment',
    showInAdjustments: true,
  }
  const preservedPenalty = {
    id: 'manual-penalty',
    name: 'Ручной штраф',
    time: 90,
    source: 'manual_team_adjustment',
    scope: 'total_adjustment',
    showInAdjustments: true,
  }
  const removedBySource = {
    id: 'system-source',
    name: 'Техническая корректировка',
    time: 60,
    source: 'captain_force_clue',
    taskIndex: 0,
    scope: 'task_elapsed',
    showInAdjustments: false,
  }
  const preservedNamedAdjustment = {
    id: 'system-name',
    name: 'Досрочная подсказка №2',
    time: 45,
    taskId: 'task-2',
    showInAdjustments: false,
  }

  const result = buildGameStartProgressUpdate({
    gameTasksCount: 3,
    startImmediately: true,
    timeAddings: [
      preservedBonus,
      removedBySource,
      preservedPenalty,
      preservedNamedAdjustment,
    ],
  })

  assert.equal(result.activeNum, 0)
  assert.equal(result.startTime.length, 3)
  assert.ok(result.startTime[0] instanceof Date)
  assert.deepEqual(result.timeAddings, [
    preservedBonus,
    preservedPenalty,
    preservedNamedAdjustment,
  ])
})

test('does not include task distribution fields in start progress reset', () => {
  const result = buildGameStartProgressUpdate({
    gameTasksCount: 3,
    startImmediately: true,
  })

  assert.equal(Object.hasOwn(result, 'taskSequence'), false)
  assert.equal(Object.hasOwn(result, 'taskSequenceSource'), false)
  assert.equal(Object.hasOwn(result, 'taskSequenceGeneratedAt'), false)
  assert.equal(Object.hasOwn(result, 'taskDistributionTemplate'), false)
})
