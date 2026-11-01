import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { loader } from './copyGameTasks.fixture.mjs'
import { memoryGameDb } from './helpers/memoryGameDb.mjs'
import buildGameStartProgressUpdate from '../server/buildGameStartProgressUpdate.js'
import buildGameResultComputed from '../server/buildGameResultComputed.js'

const sequences = [
  [0, 1, 2], [0, 2, 1], [1, 0, 2],
  [1, 2, 0], [2, 0, 1], [2, 1, 0],
]

const fixture = ({ sequence, breakDuration = 0, individualStart = false }) => {
  const tasksCount = sequence.length
  const game = {
    _id: 'game', name: 'Проверка таймеров', location: 'krsk', type: 'classic',
    status: 'started', dateStartFact: new Date(), individualStart,
    taskDuration: 1200, cluesDuration: 300, breakDuration,
    taskFailurePenalty: 60, allowCaptainFailTask: true,
    allowCaptainFinishBreak: true, taskDistributionMode: 'random',
    taskDistributionTemplate: [Array.from({ length: tasksCount }, (_, index) => index)],
    tasks: Array.from({ length: tasksCount }, (_, index) => ({
      _id: `task-${index}`, title: `Задание ${index + 1}`, task: `Текст ${index + 1}`,
      codes: [`code-${index}`], clues: [{ clue: `Подсказка ${index + 1}` }],
    })),
  }
  const gameTeam = {
    _id: 'registration', gameId: 'game', teamId: 'team', taskSequence: sequence,
    ...buildGameStartProgressUpdate({
      gameTasksCount: tasksCount, startImmediately: !individualStart,
      taskSequence: sequence, startedAt: game.dateStartFact,
    }),
  }
  const db = memoryGameDb({
    Games: [game], GamesTeams: [gameTeam],
    Teams: [{ _id: 'team', name: 'Команда' }],
    TeamsUsers: [{ userId: 'user', teamId: 'team', role: 'captain' }],
  })
  const mocks = {
    'next/server': { NextResponse: Response },
    'next-auth': { getServerSession: async () => ({ user: { userId: 'admin', role: 'admin' } }) },
    '@server/auth/authOptions': { authOptions: {} },
    '@utils/dbConnectGlobal': async () => db,
    '@server/fetchGame': async () => db.model('Games').findById('game').lean(),
    '@server/fetchTeam': async () => db.model('Teams').findById('team').lean(),
    '@server/agentNotifications': { notifyAgentsForGameTeamProgress: async () => {} },
    '@server/gameTestRuns': {},
    '@server/gameHistory/fetchGameHistoryState': async () => ({ game }),
    '@server/gameHistory/recordGameHistoryEntry': async () => {},
  }
  const load = loader(mocks)
  mocks['telegram/func/taskText'] = load(path.resolve('telegram/func/taskText.js')).default
  const state = load('@server/getTeamGameTaskState').default
  const request = (extra = {}) => state({
    location: 'krsk', gameId: 'game', teamId: 'team', userId: 'user', ...extra,
  })
  const adminAction = load('@app/api/cabinet/admin/game-status/action/route').POST
  return {
    game, db, request, team: () => db.model('GamesTeams').docs[0],
    adminAction: (action) => adminAction({ json: async () => ({ gameId: 'game', teamId: 'team', action }) }),
  }
}

const assertRunning = (response, expectedDeadline) => {
  assert.equal(response.success, true, JSON.stringify(response))
  assert.equal(response.data.taskState, 'active')
  assert.ok(response.data.taskHtml.includes(`data-target="${expectedDeadline}"`), response.data.taskHtml)
}

test('все шесть маршрутов: старт, три ответа, перерывы и результат без нулевого времени', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-01T12:00:00Z') })
  for (const sequence of sequences) {
    for (const breakDuration of [0, 90]) {
      for (const individualStart of [false, true]) {
        const f = fixture({ sequence, breakDuration, individualStart })
        let state = await f.request()
        const expectedSeconds = [0, 0, 0]
        for (let step = 0; step < 3; step += 1) {
          const index = sequence[step]
          const startedAt = f.team().startTime[index]
          assert.ok(startedAt instanceof Date, `Не запущен таймер: ${sequence}, шаг ${step}`)
          assertRunning(state, startedAt.getTime() + 1200_000)
          const elapsed = 61 + step * 17
          t.mock.timers.tick(elapsed * 1000)
          expectedSeconds[index] = elapsed
          state = await f.request({ message: `code-${index}` })
          assert.equal(f.team().endTime[index].getTime() - startedAt.getTime(), elapsed * 1000)
          if (step < 2 && breakDuration > 0) {
            assert.equal(state.data.taskState, 'break')
            assert.equal(f.team().startTime[sequence[step + 1]], null)
            t.mock.timers.tick(breakDuration * 1000)
            state = await f.request()
          }
        }
        assert.equal(state.data.taskState, 'completed')
        const result = await buildGameResultComputed({ game: {
          ...f.game,
          result: { teams: [{ _id: 'team' }], teamsUsers: [{ userId: 'user', teamId: 'team' }], gameTeams: [f.team()] },
        } })
        const computed = result.computed.teams[0]
        assert.deepEqual(computed.taskResults.map((task) => task.normalizedSeconds), expectedSeconds)
        assert.equal(computed.failurePenaltySeconds, 0)
      }
    }
  }
})

test('Game Control не создаёт нулевое выполнение при отсутствии старта задания', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-01T12:00:00Z') })
  for (const sequence of sequences) {
    for (const step of [0, 1]) {
      for (const invalidStart of [null, 'invalid-date', new Date(Date.now() + 600_000)]) {
        const f = fixture({ sequence })
        if (step === 1) {
          t.mock.timers.tick(61_000)
          await f.request({ message: `code-${sequence[0]}` })
        }
        const index = sequence[step]
        f.team().startTime[index] = invalidStart
        const before = structuredClone(f.team())
        const response = await f.adminAction('force_complete')
        assert.equal(response.status, 409)
        assert.deepEqual(f.team(), before)
      }
    }
  }
})

test('сервер не выдаёт активное задание с таймером без сохранённого времени старта', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-01T12:00:00Z') })
  const f = fixture({ sequence: [2, 0, 1] })
  f.team().startTime[2] = null
  const response = await f.request()
  assert.notEqual(response.data.taskState, 'active')
  assert.equal(response.data.taskDisplayText, '')
  assert.match(response.data.taskHtml, /время начала задания/)
})

test('повреждённый старт первого или второго задания не позволяет принять код за 0 секунд', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-01T12:00:00Z') })
  for (const sequence of sequences) {
    for (const step of [0, 1]) {
      const f = fixture({ sequence })
      if (step === 1) {
        t.mock.timers.tick(61_000)
        await f.request({ message: `code-${sequence[0]}` })
      }
      f.team().startTime[sequence[step]] = null
      const response = await f.request({ message: `code-${sequence[step]}` })
      assert.equal(f.team().endTime[sequence[step]], null)
      assert.match(response.data.result.message, /ещё не началось/)
    }
  }
})

test('таймаут и слив капитаном сохраняют старт следующего исходного задания при любом порядке', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-01T12:00:00Z') })
  for (const sequence of sequences) {
    for (const breakDuration of [0, 90]) {
      for (const outcome of ['timeout', 'captain_failure', 'early_break']) {
        const f = fixture({ sequence, breakDuration })
        const first = sequence[0], second = sequence[1]
        const initialStart = f.team().startTime[first].getTime()
        let state
        if (outcome === 'timeout') {
          t.mock.timers.tick((1200 + breakDuration) * 1000)
          state = await f.request()
          assert.equal(f.team().startTime[second].getTime(), initialStart + (1200 + breakDuration) * 1000)
        } else {
          t.mock.timers.tick(61_000)
          f.team().forcedClues[first] = 1
          state = await f.request({ action: 'failTask' })
          assert.equal(f.team().endTime[first], null)
          if (breakDuration > 0) {
            assert.equal(state.data.taskState, 'break')
            if (outcome === 'early_break') {
              t.mock.timers.tick(10_000)
              state = await f.request({ action: 'finishBreak' })
            } else {
              t.mock.timers.tick(breakDuration * 1000)
              state = await f.request()
            }
          }
          assert.equal(f.team().startTime[second].getTime(), Date.now())
        }
        assert.equal(f.team().activeNum, 1)
        assertRunning(state, f.team().startTime[second].getTime() + 1200_000)
        t.mock.timers.tick(43_000)
        await f.request({ message: `code-${second}` })
        assert.equal(f.team().endTime[second].getTime() - f.team().startTime[second].getTime(), 43_000)
      }
    }
  }
})

test('параллельные одинаковые ответы и обновления экрана не обнуляют старт второго задания', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-01T12:00:00Z') })
  for (const sequence of sequences) {
    const f = fixture({ sequence })
    t.mock.timers.tick(61_000)
    await Promise.all([
      f.request({ message: `code-${sequence[0]}` }),
      f.request({ message: `code-${sequence[0]}` }),
      f.request(),
    ])
    assert.equal(f.team().activeNum, 1)
    const secondStart = f.team().startTime[sequence[1]].getTime()
    assert.equal(secondStart, Date.now())
    t.mock.timers.tick(53_000)
    await Promise.all([f.request(), f.request()])
    assert.equal(f.team().startTime[sequence[1]].getTime(), secondStart)
    await f.request({ message: `code-${sequence[1]}` })
    assert.equal(f.team().endTime[sequence[1]].getTime() - secondStart, 53_000)
  }
})

test('Game Control сохраняет фактическую длительность при корректном старте случайного задания', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-01T12:00:00Z') })
  for (const sequence of sequences) {
    const f = fixture({ sequence })
    const index = sequence[0]
    const startedAt = f.team().startTime[index].getTime()
    t.mock.timers.tick(67_000)
    const response = await f.adminAction('force_complete')
    assert.equal(response.status, 200)
    assert.equal(f.team().endTime[index].getTime() - startedAt, 67_000)
    assert.equal(f.team().startTime[sequence[1]].getTime(), Date.now())
  }
})

test('snapshot с отсутствующим стартом не даёт нулевое время в результате', async () => {
  for (const sequence of sequences) {
    for (const step of [0, 1]) {
      const index = sequence[step]
      const startTime = [null, null, null]
      const endTime = [null, null, null]
      endTime[index] = new Date('2026-11-01T12:05:00Z')
      const result = await buildGameResultComputed({ game: {
        type: 'classic', taskDuration: 1200, taskFailurePenalty: 60,
        tasks: [{}, {}, {}],
        result: {
          teams: [{ _id: 'team' }],
          teamsUsers: [{ userId: 'user', teamId: 'team' }],
          gameTeams: [{ teamId: 'team', activeNum: step + 1, taskSequence: sequence, startTime, endTime }],
        },
      } })
      const taskResult = result.computed.teams[0].taskResults[index]
      assert.equal(taskResult.normalizedSeconds, 1200)
      assert.equal(taskResult.penaltySeconds, 60)
      assert.notEqual(taskResult.status, 'completed')
    }
  }
})

test('инцидент Династии: маршрут 2→1→3→4→5→6 и время, ошибочно записанное первому исходному заданию', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-24T12:37:26.600Z') })
  const sequence = [1, 0, 2, 3, 4, 5]
  const f = fixture({ sequence, breakDuration: 300 })
  const originalStart = new Date('2026-10-24T12:13:00.217Z')
  f.team().startTime = [originalStart, null, null, null, null, null]
  const before = structuredClone(f.team())
  const state = await f.request()
  assert.equal(state.data.taskState, 'idle')
  const response = await f.adminAction('force_complete')
  assert.equal(response.status, 409)
  assert.deepEqual(f.team(), before)

  const correctedStart = buildGameStartProgressUpdate({
    gameTasksCount: 6, startImmediately: true, taskSequence: sequence, startedAt: originalStart,
  })
  assert.equal(correctedStart.startTime[0], null)
  assert.equal(correctedStart.startTime[1].getTime(), originalStart.getTime())
})

test('сохранённая корректировка Династии даёт 24:12 на Акте 2 и не начисляется второй раз', async () => {
  const at = new Date('2026-10-24T12:37:26.600Z')
  const sequence = [1, 0, 2, 3, 4, 5]
  const result = await buildGameResultComputed({ game: {
    type: 'classic', taskDuration: 3600, taskFailurePenalty: 0,
    tasks: Array.from({ length: 6 }, (_, index) => ({ title: `Акт ${index + 1}` })),
    result: {
      teams: [{ _id: 'team' }], teamsUsers: [{ userId: 'user', teamId: 'team' }],
      gameTeams: [{ teamId: 'team', activeNum: 1, taskSequence: sequence,
        startTime: [null, at, null, null, null, null],
        endTime: [null, at, null, null, null, null],
        timeAddings: [{ name: 'Ошибка времени', time: 1452, taskIndex: 1,
          source: 'manual_team_adjustment', scope: 'task_elapsed', showInAdjustments: true }],
      }],
    },
  } })
  const team = result.computed.teams[0]
  assert.equal(team.taskResults[1].normalizedSeconds, 1452)
  assert.equal(team.taskResults[1].display, '00:24:12')
  assert.equal(team.addingsSeconds, 0)
  assert.equal(team.finalSeconds, 5 * 3600 + 1452)
})
