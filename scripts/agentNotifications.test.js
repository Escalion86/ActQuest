import test from 'node:test'
import assert from 'node:assert/strict'

import { resolveTaskEventsForTeam } from '../helpers/agentNotifications.js'

test('task notifications do not mark break-after-completion as current_task', () => {
  const now = new Date('2026-05-26T10:05:00.000Z')
  const startedAt = new Date('2026-05-26T10:00:00.000Z')
  const completedAt = new Date('2026-05-26T10:04:00.000Z')

  const events = resolveTaskEventsForTeam({
    game: {
      breakDuration: 180,
      taskDuration: 3600,
      agentNotifications: {
        onCurrentTask: true,
        onTaskCompleted: true,
      },
      tasks: [{ agentUserIds: ['agent-1'] }],
    },
    gameTeam: {
      activeNum: 0,
      startTime: [startedAt],
      endTime: [completedAt],
    },
    now,
  })

  assert.deepEqual(
    events.map((event) => event.eventType),
    ['task_completed'],
  )
})

test('task notifications treat next assigned task after break as previous_task only', () => {
  const now = new Date('2026-05-26T10:05:00.000Z')
  const startedAt = new Date('2026-05-26T10:00:00.000Z')
  const completedAt = new Date('2026-05-26T10:04:00.000Z')

  const events = resolveTaskEventsForTeam({
    game: {
      breakDuration: 180,
      taskDuration: 3600,
      agentNotifications: {
        onPreviousTask: true,
        onCurrentTask: true,
      },
      tasks: [{ agentUserIds: [] }, { agentUserIds: ['agent-1'] }],
    },
    gameTeam: {
      activeNum: 0,
      startTime: [startedAt, null],
      endTime: [completedAt, null],
    },
    now,
  })

  assert.deepEqual(
    events.map((event) => event.eventType),
    ['previous_task'],
  )
})
