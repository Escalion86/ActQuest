import test from 'node:test'
import assert from 'node:assert/strict'

import {
  resolveTeamAgentStatus,
  resolveTeamBreakState,
} from '../helpers/agentGameStatus.js'

test('team on break after assigned task completion is no longer active for agent', () => {
  const now = new Date('2026-05-26T10:05:00.000Z')
  const startedAt = new Date('2026-05-26T10:00:00.000Z')
  const completedAt = new Date('2026-05-26T10:04:00.000Z')

  const status = resolveTeamAgentStatus({
    gameTeam: {
      activeNum: 0,
      startTime: [startedAt, null],
      endTime: [completedAt, null],
    },
    assignedTaskIndexes: [0],
    tasksCount: 2,
    breakDurationSeconds: 180,
    taskDurationSeconds: 3600,
    now,
  })

  assert.equal(status.status, 'passed')
  assert.equal(status.taskIndex, 0)
})

test('team on break before next assigned task is approaching, not active on previous one', () => {
  const now = new Date('2026-05-26T10:05:00.000Z')
  const startedAt = new Date('2026-05-26T10:00:00.000Z')
  const completedAt = new Date('2026-05-26T10:04:00.000Z')

  const status = resolveTeamAgentStatus({
    gameTeam: {
      activeNum: 0,
      startTime: [startedAt, null],
      endTime: [completedAt, null],
    },
    assignedTaskIndexes: [1],
    tasksCount: 2,
    breakDurationSeconds: 180,
    taskDurationSeconds: 3600,
    now,
  })

  assert.equal(status.status, 'approaching')
  assert.equal(status.taskIndex, 1)
})

test('team on break after assigned task failure is no longer active for agent', () => {
  const now = new Date('2026-05-26T10:05:00.000Z')
  const startedAt = new Date('2026-05-26T10:00:00.000Z')
  const failedAt = new Date('2026-05-26T10:04:00.000Z')

  const status = resolveTeamAgentStatus({
    gameTeam: {
      activeNum: 0,
      startTime: [startedAt, null],
      endTime: [null, null],
      taskFailures: [{ taskIndex: 0, failedAt }],
    },
    assignedTaskIndexes: [0],
    tasksCount: 2,
    breakDurationSeconds: 180,
    taskDurationSeconds: 3600,
    now,
  })

  assert.equal(status.status, 'passed')
  assert.equal(status.taskIndex, 0)
})

test('break state exposes remaining break time for completed task', () => {
  const now = new Date('2026-05-26T10:05:00.000Z')
  const startedAt = new Date('2026-05-26T10:00:00.000Z')
  const completedAt = new Date('2026-05-26T10:04:00.000Z')

  const breakState = resolveTeamBreakState({
    gameTeam: {
      activeNum: 0,
      startTime: [startedAt, null],
      endTime: [completedAt, null],
    },
    tasksCount: 2,
    breakDurationSeconds: 180,
    taskDurationSeconds: 3600,
    now,
  })

  assert.equal(breakState.isTeamOnBreak, true)
  assert.equal(breakState.breakTimeLeftSeconds, 120)
})

const routeNow = new Date('2026-10-31T13:00:00Z')
const routeOptions = {
  tasksCount: 4,
  breakDurationSeconds: 180,
  taskDurationSeconds: 3600,
  now: routeNow,
}

test('статусы агента учитывают индивидуальный маршрут команды', () => {
  const gameTeam = {
    taskSequence: [2, 0, 1, 3],
    activeNum: 1,
    startTime: [new Date(routeNow - 60000), null, new Date(routeNow - 600000)],
    endTime: [],
  }
  for (const [taskIndex, expected] of [[0, 'active'], [1, 'approaching'], [2, 'passed'], [3, 'waiting']]) {
    const result = resolveTeamAgentStatus({ ...routeOptions, gameTeam, assignedTaskIndexes: [taskIndex] })
    assert.equal(result.status, expected)
    assert.equal(result.taskIndex, taskIndex)
  }
})

test('последний шаг маршрута не означает прохождение задания с меньшим номером', () => {
  const result = resolveTeamAgentStatus({
    ...routeOptions,
    gameTeam: { taskSequence: [2, 0, 3, 1], activeNum: 3, startTime: [null, new Date(routeNow - 60000)], endTime: [] },
    assignedTaskIndexes: [1],
  })
  assert.equal(result.status, 'active')
})

test('перерыв определяется по заданию маршрута, а не номеру шага', () => {
  const gameTeam = {
    taskSequence: [2, 0, 1, 3], activeNum: 0,
    startTime: [null, null, new Date(routeNow - 120000)],
    endTime: [null, null, new Date(routeNow - 60000)],
  }
  assert.deepEqual(resolveTeamBreakState({ ...routeOptions, gameTeam }), {
    isTeamOnBreak: true, breakTimeLeftSeconds: 120,
  })
  assert.equal(resolveTeamAgentStatus({ ...routeOptions, gameTeam, assignedTaskIndexes: [2] }).status, 'passed')
  assert.equal(resolveTeamAgentStatus({ ...routeOptions, gameTeam, assignedTaskIndexes: [0] }).status, 'approaching')
})
