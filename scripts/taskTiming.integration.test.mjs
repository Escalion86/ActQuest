import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { loader } from './copyGameTasks.fixture.mjs'
import { memoryGameDb } from './helpers/memoryGameDb.mjs'
import { runClassicVariants } from '../server/classicVariantsEngine.js'

const fixture = ({ active = 0, elapsed = 1000, sequence = [0, 1], items = false } = {}) => {
  const game = { _id: 'game', name: 'Гибкое время', location: 'krsk', type: 'classic', status: 'started', taskDuration: 2700, cluesDuration: 0, clueIntervals: [900, 600], breakDuration: 300, allowCaptainForceClue: true, allowCaptainFailTask: true, clueEarlyAccessMode: 'time', taskDistributionMode: sequence[0] === 1 ? 'random' : 'linear',
    tasks: [{ _id: 'first', stageKey: 'stage-first', title: 'Час', task: 'Первое задание', taskDuration: 3600, codes: ['done0'], clues: [{ clue: 'Первая' }, { clue: 'Вторая' }] },
      { _id: 'second', stageKey: 'stage-second', title: 'Полтора часа', task: 'Второе задание', taskDuration: 5400, clueIntervals: [600, 1200], codes: ['done1'], clues: [{ clue: 'Один' }, { clue: 'Два' }, { clue: 'Три' }] }],
    ...(items ? { classicItems: [{ id: 'clock', title: 'Маховик', kind: 'stackable', effect: { type: 'time_rewind', seconds: 300 } }] } : {}),
  }
  const starts = [null, null]
  starts[sequence[active]] = new Date(Date.now() - elapsed * 1000)
  const team = { _id: 'registration', gameId: 'game', teamId: 'team', activeNum: active, taskSequence: sequence, startTime: starts,
    ...(items ? { classicProgress: { stages: [], history: [], inventory: [{ itemId: 'clock', quantity: 1 }] } } : {}),
  }
  const db = memoryGameDb({ Games: [game], GamesTeams: [team], Teams: [{ _id: 'team', name: 'Команда' }], TeamsUsers: [{ teamId: 'team', userId: 'user', role: 'captain' }] })
  const mocks = { 'next/server': { NextResponse: Response }, 'next-auth': { getServerSession: async () => ({ user: { userId: 'user', role: 'admin' } }) }, '@server/auth/authOptions': { authOptions: {} }, '@utils/dbConnectGlobal': async () => db,
    '@server/fetchGame': async () => db.model('Games').findById('game').lean(), '@server/fetchTeam': async () => db.model('Teams').findById('team').lean(), '@server/agentNotifications': { notifyAgentsForGameTeamProgress: async () => {} }, '@server/gameTeamMessages': { fetchUnreadTeamMessageCounts: async () => ({}) }, '@server/gameTestRuns': {},
  }
  const load = loader(mocks)
  mocks['telegram/func/taskText'] = load(path.resolve('telegram/func/taskText.js')).default
  const state = load('@server/getTeamGameTaskState').default
  const get = load('@app/api/cabinet/admin/game-status/route').GET
  return { game, db, load, team: () => db.model('GamesTeams').docs[0], request: (extra = {}) => state({ location: 'krsk', gameId: 'game', teamId: 'team', userId: 'user', ...extra }), control: async () => (await get(new Request('http://localhost/api/cabinet/admin/game-status?gameId=game'))).json() }
}
const timer = (html, kind) => Number(html.match(new RegExp('data-task-countdown="'+kind+'"[^>]*data-seconds="(\\d+)"'))?.[1])

test('обычный web-движок использует собственный лимит и общее неравномерное расписание', async () => {
  const f = fixture()
  const state = await f.request()
  assert.equal(state.success, true)
  assert.equal(state.data.taskState, 'active')
  assert.equal(state.data.taskDisplayClues.length, 1)
  assert.ok(timer(state.data.taskHtml, 'task') > 2590 && timer(state.data.taskHtml, 'task') <= 2600)
  assert.ok(state.data.captainActions.forceClueAdvanceSeconds > 490 && state.data.captainActions.forceClueAdvanceSeconds <= 500)
  const control = await f.control()
  assert.equal(control.success, true)
  assert.equal(control.data.teams[0].taskDurationSeconds, 3600)
  assert.ok(control.data.teams[0].nextClueInSeconds > 490 && control.data.teams[0].nextClueInSeconds <= 500)
  assert.equal(control.data.teams[0].cluesReceived, 1)
})

test('досрочная подсказка берёт остаток до её конкретного момента, а не равный интервал', async () => {
  const f = fixture()
  const state = await f.request({ action: 'forceClue', stageId: 'stage-first' })
  assert.equal(state.success, true)
  assert.equal(state.data.taskDisplayClues.length, 2)
  assert.ok(f.team().timeAddings[0].time > 490 && f.team().timeAddings[0].time <= 500)
})

test('полуторачасовое задание остаётся активным после общего лимита игры', async () => {
  const f = fixture({ active: 1, elapsed: 3700 })
  const state = await f.request()
  assert.equal(state.data.taskState, 'active')
  assert.equal(state.data.taskDisplayClues.length, 3)
  assert.ok(timer(state.data.taskHtml, 'task') > 1690 && timer(state.data.taskHtml, 'task') <= 1700)
  const completed = await f.request({ message: 'done1' })
  assert.equal(completed.data.taskState, 'completed')
})

test('после таймаута и перерыва следующее задание получает свой полный лимит', async () => {
  const f = fixture({ elapsed: 4000 })
  const state = await f.request()
  assert.equal(state.data.taskState, 'active')
  assert.equal(f.team().activeNum, 1)
  assert.match(state.data.taskDisplayTaskText, /Второе/)
  assert.ok(timer(state.data.taskHtml, 'task') > 5290 && timer(state.data.taskHtml, 'task') <= 5300)
  assert.equal(new Date(f.team().startTime[1]).getTime() - new Date(f.team().startTime[0]).getTime(), 3900_000)
})

test('индивидуальные лимиты привязаны к исходному заданию при случайном маршруте', async () => {
  const f = fixture({ sequence: [1, 0], elapsed: 3700 })
  const state = await f.request()
  assert.equal(state.data.taskState, 'active')
  assert.match(state.data.taskDisplayTaskText, /Второе/)
  const control = await f.control()
  assert.equal(control.data.teams[0].taskDurationSeconds, 5400)
  assert.equal(control.data.taskOverview[1].teams[0].remainingSeconds > 1690, true)
})

test('без подсказок капитан может слить задание, полный лимит сохраняется без endTime', async () => {
  const f = fixture()
  f.db.model('Games').docs[0].tasks[0].clues = []
  const state = await f.request()
  assert.equal(state.data.captainActions.canFailTask, true)
  const failed = await f.request({ action: 'failTask', stageId: 'stage-first' })
  assert.equal(failed.data.taskState, 'break')
  assert.equal(f.team().endTime?.[0] ?? null, null)
  const control = await f.control()
  assert.equal(control.data.teams[0].teamProgressStats.tasks[0].completedSeconds, 3600)
})

test('телепорт и досрочная подсказка используют одно неравномерное расписание', async () => {
  const f = fixture({ elapsed: 1200, items: true })
  const rewound = await f.request({ action: 'useItem', itemId: 'clock', stageId: 'stage-first', requestId: 'timing-teleport-1' })
  assert.equal(rewound.data.taskDisplayClues.length, 1)
  assert.ok(rewound.data.captainActions.forceClueAdvanceSeconds > 590 && rewound.data.captainActions.forceClueAdvanceSeconds <= 600)
  const forced = await f.request({ action: 'forceClue', stageId: 'stage-first' })
  assert.equal(forced.data.taskDisplayClues.length, 2)
  const control = await f.control()
  assert.equal(Math.floor(control.data.teams[0].currentTaskSeconds), 1500)
})

test('движок вариантов завершает этап по его собственному лимиту и сохраняет время выбора', () => {
  const now = new Date('2026-11-04T12:00:00Z')
  const game = { type: 'classic', status: 'started', taskDuration: 3600, breakDuration: 300, clueIntervals: [900, 600], tasks: [{ _id: 'task', taskDuration: 5400, codes: ['done'], variantConfig: { enabled: true, mode: 'captain', offerDefaultAlways: true }, variants: [{ id: 'path', title: 'Путь', content: { codes: ['other'], clues: [{ clue: 'Подсказка' }] } }] }] }
  const before = { startTime: [new Date(now.getTime() - 4000_000)] }
  const selected = runClassicVariants({ game, gameTeam: before, now, isCaptain: true, action: 'selectVariant', stageId: 'task', variantId: 'path' })
  assert.equal(selected.result.statusCode, 200)
  assert.equal(selected.gameTeam.activeNum, 0)
  assert.equal(new Date(selected.gameTeam.startTime[0]).getTime(), before.startTime[0].getTime())
  const expired = runClassicVariants({ game, gameTeam: selected.gameTeam, now: new Date(now.getTime() + 1400_000) })
  assert.equal(expired.gameTeam.activeNum, 1)
  assert.equal(new Date(expired.gameTeam.taskFailures[0].failedAt).getTime(), before.startTime[0].getTime() + 5400_000)
})

test('Mongoose и копирование заданий сохраняют индивидуальное время и расписание', () => {
  const f = fixture()
  const mongoose = f.load('mongoose')
  const schema = new mongoose.Schema(f.load('@schemas/gamesSchema').default)
  const Model = mongoose.models.TaskTimingCasting || mongoose.model('TaskTimingCasting', schema)
  const game = new Model({ clueIntervals: [900, 600], tasks: [{ title: 'Задание', taskDuration: 5400, clueIntervals: [600, 1200], allowIncompleteClues: true, codes: ['code'] }] })
  const source = game.toObject()
  assert.deepEqual(source.clueIntervals, [900, 600])
  assert.equal(source.tasks[0].taskDuration, 5400)
  assert.deepEqual(source.tasks[0].clueIntervals, [600, 1200])
  assert.equal(source.tasks[0].allowIncompleteClues, true)
  const { buildCopiedTasks } = f.load('@server/copyGameTasks')
  const copied = buildCopiedTasks(Model, source.tasks)
  assert.equal(copied[0].taskDuration, 5400)
  assert.deepEqual(copied[0].clueIntervals, [600, 1200])
  assert.equal(copied[0].allowIncompleteClues, true)
  const old = new Model({ tasks: [{ title: 'Старое задание' }] }).toObject()
  assert.equal(old.clueIntervals, null)
  assert.equal(old.tasks[0].taskDuration, null)
  assert.equal(old.tasks[0].clueIntervals, null)
  assert.equal(old.tasks[0].allowIncompleteClues, false)
})

test('настоящий запуск игры блокируется без галочки и проходит после её сохранения', async () => {
  const game = { _id: 'game', location: 'krsk', name: 'Проверка подсказок', status: 'active', type: 'classic', startingPlace: 'Старт', finishingPlace: 'Финиш', taskDuration: 3600, cluesDuration: 900,
    tasks: [{ _id: 'task', title: 'Задание', task: 'Описание', codes: ['done'], clues: [{ clue: 'Одна подсказка' }] }],
  }
  const db = memoryGameDb({ Games: [game], GamesTeams: [], Teams: [], TeamsUsers: [] })
  const load = loader({
    'telegram/func/check': () => null,
    'telegram/func/formatGameName': (value) => value.name,
    'telegram/func/getGame': async () => db.model('Games').findById('game').lean(),
    'telegram/sendMessage': async () => {},
    '@server/storyEngine': {}, '@server/applyPrequelStoryEffects': () => null,
  })
  const start = load(path.resolve('server/gameStart.js')).default
  const params = { db, location: 'krsk', jsonCommand: { gameId: 'game', confirm: true } }
  const denied = await start(params)
  assert.equal(denied.success, false)
  assert.match(denied.errors.join(' '), /недостаточно подсказок \(1\/3\)/)
  assert.equal(db.model('Games').docs[0].status, 'active')
  assert.equal(db.model('Games').writes.length, 0)
  db.model('Games').docs[0].tasks[0].allowIncompleteClues = true
  const started = await start(params)
  assert.ok(started.success !== false)
  assert.equal(db.model('Games').docs[0].status, 'started')
})
