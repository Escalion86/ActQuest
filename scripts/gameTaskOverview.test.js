import test from 'node:test'
import assert from 'node:assert/strict'
import buildGameTaskOverview from '../helpers/buildGameTaskOverview.js'

const tasks = [{ title: 'Архив' }, { title: 'Антенна' }, { title: 'Штаб' }]
const makeTeam = (patch = {}) => ({
  teamId: 'team-1', teamName: 'Команда', activeTaskIndex: 2,
  taskSequence: [2, 0, 1], isTeamFinished: false,
  teamProgressStats: { tasks: [] }, ...patch,
})
const overview = (teams, taskList = tasks) => buildGameTaskOverview({ tasks: taskList, teams, taskDuration: 600 })

test('случайный маршрут группируется по исходному заданию, а не шагу команды', () => {
  const result = overview([
    makeTeam({ teamProgressStats: { tasks: [{ taskIndex: 2, startedAt: '2026-10-18T10:00:00Z' }] } }),
    makeTeam({ teamId: 'team-2', taskSequence: [0, 1, 2], activeTaskIndex: 0,
      teamProgressStats: { tasks: [{ taskIndex: 0, startedAt: '2026-10-18T10:00:00Z' }] } }),
  ])
  assert.equal(result[0].counts.active, 1)
  assert.equal(result[0].counts.pending, 1)
  assert.equal(result[1].counts.pending, 2)
  assert.equal(result[2].teams.find((team) => team.teamId === 'team-1').state, 'active')
  for (const task of result) assert.equal(Object.values(task.counts).reduce((a, b) => a + b, 0), 2)
})

test('успех на перерыве уже считается выполнением, слив и таймаут — неуспехом', () => {
  const result = overview([
    makeTeam({ isTeamOnBreak: true, teamProgressStats: { tasks: [{ taskIndex: 2, endedAt: '2026-10-18T10:10:00Z' }] } }),
    makeTeam({ teamId: 'captain', teamProgressStats: { tasks: [{ taskIndex: 2, isFailedTask: true, failedByCaptain: true, completedSeconds: 600 }] } }),
    makeTeam({ teamId: 'timeout', teamProgressStats: { tasks: [{ taskIndex: 2, isFailedTask: true, completedSeconds: 600 }] } }),
  ])[2]
  assert.equal(result.counts.active, 0)
  assert.equal(result.counts.completed, 1)
  assert.equal(result.counts.failed, 2)
  assert.equal(result.teams[1].failureReason, 'Слив капитаном')
  assert.equal(result.teams[2].failureReason, 'Время вышло')
})

test('история финишировавшей команды сохраняет успехи и неуспехи', () => {
  const result = overview([makeTeam({ activeTaskIndex: 3, isTeamFinished: true,
    teamProgressStats: { tasks: [
      { taskIndex: 0, endedAt: '2026-10-18T10:10:00Z' },
      { taskIndex: 1, isFailedTask: true, failedByTimeout: true },
      { taskIndex: 2, endedAt: '2026-10-18T10:00:00Z' },
    ] },
  })])
  assert.deepEqual(result.map((task) => task.teams[0].state), ['completed', 'failed', 'completed'])
})

test('административный пропуск не выдаётся за таймаут', () => {
  const result = overview([makeTeam({ teamProgressStats: { tasks: [
    { taskIndex: 2, isFailedTask: true, failureSource: 'admin', completedSeconds: 600 },
  ] } })])[2]
  assert.equal(result.teams[0].failureReason, 'Пропущено администратором')
})

test('неначатое задание не считается активным, выбор варианта считается', () => {
  assert.equal(overview([makeTeam()])[2].counts.pending, 1)
  const task = overview([makeTeam({ isChoosingVariant: true })])[2]
  assert.equal(task.counts.active, 1)
  assert.equal(task.teams[0].isChoosingVariant, true)
  assert.equal(task.teams[0].remainingSeconds, null)
})

test('время и требуемые коды берутся для выбранного варианта команды', () => {
  const task = overview([makeTeam({ currentTaskSeconds: 250,
    teamProgressStats: { tasks: [{ taskIndex: 2, startedAt: '2026-10-18T10:00:00Z',
      variantTitle: 'Обход', requiredCodesCount: 2, mainCodes: [{ code: 'x' }] }] },
  })])[2].teams[0]
  assert.equal(task.remainingSeconds, 350)
  assert.equal(task.requiredCodesCount, 2)
  assert.equal(task.foundCodesCount, 1)
  assert.equal(task.variantTitle, 'Обход')
})

test('отменённые и отсутствующие в маршруте задания не увеличивают ожидание', () => {
  const result = overview([makeTeam({ taskSequence: [2] })], [{ canceled: true }, tasks[1], tasks[2]])
  assert.equal(result[0].canceled, true)
  assert.equal(result[0].counts.pending, 0)
  assert.equal(result[1].counts.excluded, 1)
  assert.equal(result[1].counts.pending, 0)
})

test('пустая игра и игра без команд возвращают пустые счётчики', () => {
  assert.deepEqual(overview([], []), [])
  assert.equal(overview([])[0].counts.active, 0)
  assert.deepEqual(overview([])[0].teams, [])
})
