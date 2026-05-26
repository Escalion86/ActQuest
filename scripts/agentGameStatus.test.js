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
