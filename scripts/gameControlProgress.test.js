import test from 'node:test'
import assert from 'node:assert/strict'
import { compareGameControlTeams, getControlTaskTitle } from '../helpers/gameControlProgress.js'

const team = (overrides) => ({
  activeTaskStep: 0, activeTaskIndex: 0, currentTaskSeconds: 0,
  findedCodesCount: 0, sumTimeSeconds: 0, ...overrides,
})

test('команда на втором шаге выше команды на первом независимо от номеров заданий', () => {
  const dynasty = team({ activeTaskStep: 1, activeTaskIndex: 0 })
  const firstStep = team({ activeTaskStep: 0, activeTaskIndex: 1, currentTaskSeconds: 1800 })
  assert.deepEqual([firstStep, dynasty].sort(compareGameControlTeams), [dynasty, firstStep])
})

test('на одном шаге сохраняется приоритет перерыва и времени на задании', () => {
  const active = team({ currentTaskSeconds: 100 })
  const longer = team({ currentTaskSeconds: 200 })
  const onBreak = team({ isTeamOnBreak: true, breakTimeLeftSeconds: 100 })
  assert.deepEqual([active, onBreak, longer].sort(compareGameControlTeams), [onBreak, longer, active])
})

test('финишировавшие команды упорядочены по общему времени', () => {
  const fast = team({ activeTaskStep: 6, isTeamFinished: true, sumTimeSeconds: 1000 })
  const slow = team({ activeTaskStep: 6, isTeamFinished: true, sumTimeSeconds: 2000 })
  assert.deepEqual([slow, fast].sort(compareGameControlTeams), [fast, slow])
})

test('название не содержит исходный номер задания и не дублирует публичный заголовок', () => {
  const data = { useCustomTaskPublicTitles: true, tasks: [{ publicTitle: 'АКТ 1' }] }
  assert.equal(getControlTaskTitle(data, 0, 'Акт 1'), 'АКТ 1')
  assert.equal(getControlTaskTitle({ ...data, useCustomTaskPublicTitles: false }, 0, 'Акт 1'), 'Акт 1')
  assert.equal(getControlTaskTitle({}, 2, ''), 'Без названия')
})
