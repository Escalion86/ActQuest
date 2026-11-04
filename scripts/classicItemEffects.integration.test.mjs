import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { loader } from './copyGameTasks.fixture.mjs'
import { memoryGameDb } from './helpers/memoryGameDb.mjs'
import { CLASSIC_ITEM_EFFECTS } from '../helpers/classicItemDefinitions.js'

const fixture = (effect = { type: 'time_rewind', seconds: 300 }, setup) => {
  const game = { _id: 'game', name: 'Телепорт', location: 'krsk', type: 'classic', status: 'started', taskDuration: 3600, breakDuration: 10, cluesDuration: 900,
    tasks: [{ _id: 'task', stageKey: 'stage', title: 'Задание', task: 'Найдите код', codes: ['finish'], clues: [{ clue: 'Первая подсказка' }, { clue: 'Вторая подсказка' }] }],
    classicItems: [{ id: 'clock', title: 'Маховик времени', kind: 'stackable', effect }],
  }
  const registration = { _id: 'registration', gameId: 'game', teamId: 'team', activeNum: 0, startTime: [new Date(Date.now() - 1000_000)], classicProgress: { inventory: [{ itemId: 'clock', quantity: 2 }], stages: [], history: [] } }
  setup?.(game, registration)
  const db = memoryGameDb({ Games: [game], GamesTeams: [registration],
    Teams: [{ _id: 'team', name: 'Команда' }], TeamsUsers: [{ userId: 'user', teamId: 'team', role: 'captain' }] })
  const mocks = {
    'next/server': { NextResponse: Response },
    'next-auth': { getServerSession: async () => ({ user: { userId: 'user', role: 'admin' } }) },
    '@server/auth/authOptions': { authOptions: {} },
    '@utils/dbConnectGlobal': async () => db,
    '@server/fetchGame': async () => db.model('Games').findById('game').lean(),
    '@server/fetchTeam': async () => db.model('Teams').findById('team').lean(),
    '@server/agentNotifications': { notifyAgentsForGameTeamProgress: async () => {} },
    '@server/gameTeamMessages': { fetchUnreadTeamMessageCounts: async () => ({}) },
    '@server/gameTestRuns': {},
  }
  const load = loader(mocks)
  mocks['telegram/func/taskText'] = load(path.resolve('telegram/func/taskText.js')).default
  const post = load('@app/api/webapp/game-task/route').POST
  const get = load('@app/api/cabinet/admin/game-status/route').GET
  return { db, load, game: db.model('Games').docs[0], team: () => db.model('GamesTeams').docs[0], request: (extra = {}) => post({ json: async () => ({ location: 'krsk', gameId: 'game', teamId: 'team', ...extra }) }),
    control: () => get(new Request('http://localhost/api/cabinet/admin/game-status?gameId=game')) }
}

test('API состояния, таймер HTML и Game Control согласованы после телепорта', async () => {
  const f = fixture()
  const first = await (await f.request()).json()
  assert.equal(first.success, true)
  assert.equal(first.data.inventory[0].canUse, true)
  assert.equal(first.data.taskDisplayClues.length, 1)
  const response = await f.request({ action: 'useItem', stageId: 'stage', itemId: 'clock', requestId: 'request-1000' })
  assert.equal(response.status, 200)
  const json = await response.json()
  assert.equal(json.data.inventory[0].quantity, 1)
  assert.equal(json.data.taskDisplayClues.length, 1)
  const taskSeconds = Number(json.data.taskHtml.match(/data-task-countdown="task"[^>]*data-seconds="(\d+)"/)?.[1])
  assert.ok(taskSeconds >= 2898 && taskSeconds <= 2900, `Осталось примерно 2900 секунд, получено ${taskSeconds}`)
  const control = await (await f.control()).json()
  assert.equal(control.success, true)
  const team = control.data.teams[0]
  assert.ok(team.currentTaskSeconds >= 700 && team.currentTaskSeconds <= 702)
  assert.equal(team.cluesReceived, 1)
  assert.equal(team.teamProgressStats.totalTimeBonusSeconds, 300)
  assert.match(team.teamProgressStats.tasks[0].timeBonuses[0].name, /Маховик/)
  assert.equal((await f.request({ message: 'finish' })).status, 200)
  const completedControl = await (await f.control()).json()
  const completed = completedControl.data.teams[0]
  assert.ok(completed.sumTimeSeconds >= 700 && completed.sumTimeSeconds <= 702)
  assert.ok(completed.teamProgressStats.tasks[0].completedSeconds >= 700 && completed.teamProgressStats.tasks[0].completedSeconds <= 702)
})

test('параллельные API-запросы с одним ID сохраняют один расход под блокировкой', async () => {
  const f = fixture()
  await f.request()
  const action = { action: 'useItem', stageId: 'stage', itemId: 'clock', requestId: 'request-1001' }
  const results = await Promise.all([f.request(action), f.request(action)])
  assert.ok(results.some((result) => result.status === 200))
  await f.request(action)
  const team = f.db.model('GamesTeams').docs[0]
  assert.equal(team.classicProgress.inventory[0].quantity, 1)
  assert.equal(team.timeAddings.length, 1)
  assert.equal(team.classicProgress.history.filter((event) => event.type === 'item_used').length, 1)
})

test('API проверяет полномочия капитана и не доверяет клиентскому размеру бонуса', async () => {
  const f = fixture()
  const response = await f.request({ action: 'useItem', stageId: 'stage', itemId: 'clock', requestId: 'request-1002', seconds: 9999 })
  assert.equal(response.status, 200)
  assert.equal(f.db.model('GamesTeams').docs[0].timeAddings[0].time, -300)
  f.db.model('TeamsUsers').docs[0].role = 'member'
  const denied = await f.request({ action: 'useItem', stageId: 'stage', itemId: 'clock', requestId: 'request-1003' })
  assert.equal(denied.status, 403)
  assert.equal(f.db.model('GamesTeams').docs[0].classicProgress.inventory[0].quantity, 1)
})

test('Mongoose сохраняет настройки эффекта и не добавляет эффект старым предметам', () => {
  const f = fixture()
  const mongoose = f.load('mongoose')
  const schema = new mongoose.Schema(f.load('@schemas/gamesSchema').default)
  const Model = mongoose.models.TeleportEffectCasting || mongoose.model('TeleportEffectCasting', schema)
  const game = new Model({ classicItems: [{ id: 'old', title: 'Ключ', kind: 'unique' }, { id: 'clock', title: 'Маховик', kind: 'stackable', effect: { type: 'time_rewind', seconds: 300, allowedStageIds: ['stage'] } }] })
  assert.equal(game.classicItems[0].effect, null)
  assert.deepEqual(game.toObject().classicItems[1].effect, { type: 'time_rewind', seconds: 300, allowedStageIds: ['stage'] })
})

const activation = (extra = {}) => ({ action: 'useItem', stageId: 'stage', itemId: 'clock', requestId: 'request-effect-1000', ...extra })

for (const type of ['secret_clue', 'compass']) test(`API ${type}: скрытая помощь выдаётся только после расхода предмета`, async () => {
  const f = fixture({ type, text: 'СЕКРЕТНЫЙ ОРИЕНТИР', image: 'https://example.org/secret-map.png' })
  const first = await (await f.request()).json()
  assert.ok(!JSON.stringify(first).includes('СЕКРЕТНЫЙ ОРИЕНТИР'))
  assert.ok(!JSON.stringify(first).includes('secret-map.png'))
  const applied = await (await f.request(activation())).json()
  assert.equal(applied.success, true)
  assert.equal(applied.data.itemHelp[0].text, 'СЕКРЕТНЫЙ ОРИЕНТИР')
  assert.equal(applied.data.inventory[0].quantity, 1)
  assert.equal(applied.data.inventory[0].canUse, false)
  const refreshed = await (await f.request()).json()
  assert.equal(refreshed.data.itemHelp[0].image, 'https://example.org/secret-map.png')
  const denied = await f.request(activation({ requestId: 'request-effect-1001' }))
  assert.equal(denied.status, 409)
  assert.equal(f.team().classicProgress.inventory[0].quantity, 1)
})

test('API хрустального шара открывает следующую подсказку без корректировки времени', async () => {
  const f = fixture({ type: 'free_clue' })
  const result = await (await f.request(activation())).json()
  assert.equal(result.data.taskDisplayClues.length, 2)
  assert.equal(f.team().timeAddings.length, 0)
  assert.equal(result.data.inventory[0].canUse, false)
  const control = await (await f.control()).json()
  assert.equal(control.data.teams[0].cluesReceived, 2)
  assert.match(control.data.teams[0].teamProgressStats.tasks[0].itemEffects[0].description, /бесплатно/)
})

test('API заморозки согласует оба таймера, паузу клиента и использованный бонус в результате', async () => {
  const f = fixture({ type: 'time_freeze', seconds: 120 })
  let result = await (await f.request(activation())).json()
  assert.equal(result.success, true)
  assert.match(result.data.taskHtml, /data-pause-seconds="120"/)
  assert.match(result.data.taskHtml, /data-task-countdown="freeze"/)
  assert.equal(result.data.freezeRemainingSeconds, 120)
  // Прошло 30 секунд: переносим обе отметки времени, сохраняя игровую длительность.
  f.team().startTime[0] = new Date(new Date(f.team().startTime[0]).getTime() - 30_000)
  f.team().timeAddings[0].createdAt = new Date(Date.now() - 30_000)
  result = await (await f.request()).json()
  assert.ok(result.data.freezeRemainingSeconds >= 89 && result.data.freezeRemainingSeconds <= 90)
  const control = await (await f.control()).json()
  assert.ok(control.data.teams[0].currentTaskSeconds >= 999 && control.data.teams[0].currentTaskSeconds <= 1002)
  assert.ok(control.data.teams[0].teamProgressStats.totalTimeBonusSeconds >= 30 && control.data.teams[0].teamProgressStats.totalTimeBonusSeconds <= 31)
  await f.request({ message: 'finish' })
  assert.ok(f.team().timeAddings[0].time <= -30 && f.team().timeAddings[0].time >= -31)
  const completed = await (await f.control()).json()
  assert.ok(completed.data.teams[0].teamProgressStats.tasks[0].completedSeconds >= 999 && completed.data.teams[0].teamProgressStats.tasks[0].completedSeconds <= 1002)
})

test('API щита компенсирует штраф, сохраняя ввод и журнал для администратора', async () => {
  const f = fixture({ type: 'penalty_shield' })
  f.game.tasks[0].penaltyCodes = [{ code: 'trap', penalty: 120 }]
  const applied = await (await f.request(activation())).json()
  assert.equal(applied.data.activeShields, 1)
  const code = await (await f.request({ message: 'trap' })).json()
  assert.equal(code.data.activeShields, 0)
  assert.deepEqual(f.team().findedPenaltyCodes[0], ['trap'])
  assert.equal(f.team().timeAddings[0].time, -120)
  const control = await (await f.control()).json()
  const stats = control.data.teams[0].teamProgressStats
  assert.equal(stats.totalPenaltySeconds, 120)
  assert.equal(stats.totalBonusSeconds, 120)
  assert.equal(stats.totalFinalSeconds, stats.totalTasksTimeSeconds)
  assert.equal(stats.tasks[0].itemEffects.length, 2)
})

test('API ластика проверяет цель и сохраняет единственную компенсацию при гонке запросов', async () => {
  const f = fixture({ type: 'penalty_erase' })
  f.game.tasks[0].penaltyCodes = [{ code: 'trap', penalty: 120 }]
  await f.request({ message: 'trap' })
  const first = await (await f.request()).json()
  assert.deepEqual(first.data.inventory[0].penalties.map((entry) => entry.key), ['code:trap'])
  assert.equal((await f.request(activation({ penaltyKey: 'fake' }))).status, 400)
  const results = await Promise.all([
    f.request(activation({ penaltyKey: 'code:trap' })),
    f.request(activation({ requestId: 'request-effect-1001', penaltyKey: 'code:trap' })),
  ])
  assert.equal(results.filter((response) => response.status === 200).length, 1)
  assert.equal(f.team().classicProgress.inventory[0].quantity, 1)
  assert.equal(f.team().timeAddings.length, 1)
  assert.equal(f.team().timeAddings[0].time, -120)
})

test('API отмычки обновляет счётчик кодов, а последний код завершает задание', async () => {
  const f = fixture({ type: 'lockpick' })
  f.game.tasks[0].codes = ['one', 'two']
  const applied = await (await f.request(activation())).json()
  assert.equal(applied.data.taskDisplayMeta.virtualCodesCount, 1)
  assert.deepEqual(applied.data.taskDisplayMeta.acceptedMainCodes, [])
  assert.match(applied.data.taskHtml, /Осталось найти 1 код/)
  assert.deepEqual(f.team().findedCodes[0], [])
  const control = await (await f.control()).json()
  assert.equal(control.data.teams[0].findedCodesCount, 1)
  assert.equal(control.data.teams[0].teamProgressStats.tasks[0].virtualCodesCount, 1)
  const final = await (await f.request({ message: 'two' })).json()
  assert.equal(final.success, true)
  assert.ok(f.team().endTime[0])
})

test('API портала завершает задание и показывает источник выполнения в Game Control', async () => {
  const f = fixture({ type: 'portal' })
  const applied = await (await f.request(activation())).json()
  assert.equal(applied.success, true)
  assert.ok(f.team().endTime[0])
  assert.equal(f.team().taskFailures.length, 0)
  assert.equal(f.team().classicProgress.inventory[0].quantity, 1)
  const control = await (await f.control()).json()
  assert.equal(control.data.teams[0].teamProgressStats.tasks[0].completionSource, 'portal')
  assert.equal(control.data.teams[0].teamProgressStats.tasks[0].isFailedTask, false)
  await f.request(activation())
  assert.equal(f.team().classicProgress.inventory[0].quantity, 1)
})

const withGameClock = async (run) => {
  const NativeDate = globalThis.Date
  const origin = NativeDate.UTC(2026, 10, 4, 12)
  let current = origin
  globalThis.Date = class extends NativeDate {
    constructor(...args) { super(...(args.length ? args : [current])) }
    static now() { return current }
  }
  try { return await run((seconds) => { current = origin + seconds * 1000 }, new NativeDate(origin)) }
  finally { globalThis.Date = NativeDate }
}

const mixedFixture = (startedAt, options = {}) => fixture(null, (game, registration) => {
  Object.assign(game, { taskDuration: 1800, breakDuration: 30, clueIntervals: [300, 450, 900], manyCodesPenalty: [2, 60], taskFailurePenalty: 180, ...options })
  game.classicItems = CLASSIC_ITEM_EFFECTS.map(({ type, title, seconds }) => ({ id: type, title, kind: 'stackable', effect: { type, ...(seconds ? { seconds } : {}), ...(['secret_clue', 'compass'].includes(type) ? { text: 'Скрытая помощь' } : {}) } }))
  Object.assign(game.tasks[0], { codes: ['a', 'b', 'c'], clues: [{ clue: 'Первая' }, { clue: 'Вторая' }, { clue: 'Третья' }], penaltyCodes: [{ code: 'trap', penalty: 120 }, { code: 'trap2', penalty: 90 }] })
  game.tasks.push({ _id: 'second', stageKey: 'second', taskDuration: options.taskDuration === 0 ? null : 2700, codes: ['next'], clues: [] }, { _id: 'third', stageKey: 'third', taskDuration: options.taskDuration === 0 ? null : 900, codes: ['last'], clues: [] })
  registration.startTime = [startedAt]
  registration.classicProgress.inventory = game.classicItems.map((item) => ({ itemId: item.id, quantity: 3 }))
})
const mixedActivation = (type, extra = {}) => activation({ itemId: type, requestId: `mixed-${type}`, ...extra })

test('API: все девять эффектов на одном задании, повторные запросы, Game Control и финальная статистика', async () => withGameClock(async (clock, startedAt) => {
  const f = mixedFixture(startedAt)
  const send = async (input = {}) => {
    const response = await f.request(input)
    assert.equal(response.status, 200, (await response.clone().text()).slice(0, 300))
    return (await response.json()).data
  }
  clock(580); await send({ message: 'trap', stageId: 'stage' })
  clock(600); await send(mixedActivation('time_freeze'))
  const same = mixedActivation('free_clue')
  const repeated = await Promise.all([f.request(same), f.request(same), f.request(same)])
  assert.ok(repeated.every((response) => response.status === 200))
  assert.equal(f.team().classicProgress.inventory.find((item) => item.itemId === 'free_clue').quantity, 2)
  for (const type of ['secret_clue', 'compass', 'penalty_shield', 'penalty_erase', 'lockpick', 'time_rewind']) await send(mixedActivation(type, { penaltyKey: type === 'penalty_erase' ? 'code:trap' : null }))
  clock(610); await send({ message: 'trap2', stageId: 'stage' })
  clock(620); await send({ message: 'wrong', stageId: 'stage' })
  clock(630); await send({ message: 'wrong', stageId: 'stage' })
  const active = (await (await f.control()).json()).data.teams[0]
  assert.equal(active.currentTaskSeconds, 300)
  assert.equal(active.freezeRemainingSeconds, 90)
  assert.equal(active.cluesReceived, 2)
  clock(650); const used = await send(mixedActivation('portal'))
  assert.equal(used.taskState, 'break')
  assert.equal(f.team().activeNum, 0)
  assert.equal(f.team().classicProgress.history.filter((event) => event.type === 'item_used').length, 9)
  const firstStats = (await (await f.control()).json()).data.teams[0].teamProgressStats
  assert.equal(firstStats.tasks[0].completedSeconds, 300)
  assert.equal(firstStats.tasks[0].timeBonuses.reduce((sum, item) => sum + item.seconds, 0), 350)
  assert.equal(firstStats.totalPenaltySeconds, 270)
  assert.equal(firstStats.totalBonusSeconds, 210)
  clock(679); assert.equal((await send()).stageId, 'stage')
  clock(680); assert.equal((await send()).stageId, 'second')
  assert.equal(new Date(f.team().startTime[1]).getTime(), new Date(startedAt).getTime() + 680000)
  for (const type of CLASSIC_ITEM_EFFECTS.map((effect) => effect.type)) {
    assert.equal((await f.request(mixedActivation(type, { requestId: `late-${type}` }))).status, 409)
  }
  for (const action of ['forceClue', 'failTask', 'finishBreak']) {
    assert.equal((await f.request({ action, stageId: 'stage' })).status, 409)
    assert.equal((await f.request({ action })).status, 400)
  }
  assert.equal(f.team().activeNum, 1)
  assert.equal(f.team().taskFailures.length, 0)
  assert.equal(f.team().timeAddings.length, 4)
  clock(740); await send({ message: 'next', stageId: 'second' })
  clock(770); assert.equal((await send()).stageId, 'third')
  clock(790); await send({ message: 'last', stageId: 'third' })
  const computed = (await f.load('@server/buildGameResultComputed').default({ game: { ...f.game, dateEndFact: new Date(), result: { teams: [{ _id: 'team' }], teamsUsers: [{ teamId: 'team' }], gameTeams: [f.team()] } } })).computed.teams[0]
  const control = (await (await f.control()).json()).data.teams[0]
  assert.equal(f.team().activeNum, 3)
  assert.equal(control.isTeamFinished, true)
  assert.deepEqual(computed.taskResults.map((task) => task.seconds), [300, 60, 20])
  assert.equal(computed.finalSeconds, 440)
  assert.equal(control.teamProgressStats.totalFinalSeconds, computed.finalSeconds)
  assert.equal(control.sumTimeSeconds, computed.baseSeconds)
  assert.equal(computed.taskResults[0].itemEffects.length, 10)
  assert.equal(new Set(f.team().classicProgress.history.map((entry) => entry.key)).size, f.team().classicProgress.history.length)
}))

test('API: одновременные портал, последняя отмычка и верный код завершают этап ровно один раз', async () => withGameClock(async (clock, startedAt) => {
  const f = mixedFixture(startedAt, { breakDuration: 0 })
  f.game.tasks[0].numCodesToCompliteTask = 1
  clock(600)
  const responses = await Promise.all([
    f.request(mixedActivation('portal')),
    f.request(mixedActivation('lockpick')),
    f.request({ message: 'a', stageId: 'stage' }),
  ])
  assert.equal(responses.filter((response) => response.status === 200).length, 1)
  assert.equal(f.team().activeNum, 1)
  assert.equal(f.team().classicProgress.history.filter((event) => event.type === 'stage_finished').length, 1)
  assert.equal(f.team().findedCodes[1].length, 0)
  assert.equal(f.team().taskFailures.length, 0)
  assert.equal(new Date(f.team().startTime[1]).getTime(), new Date(startedAt).getTime() + 600000)
}))

test('API: временные эффекты на задании без лимита не создают ложный финиш в Game Control', async () => withGameClock(async (clock, startedAt) => {
  const f = mixedFixture(startedAt, { taskDuration: 0 })
  clock(600)
  for (const type of ['time_freeze', 'time_rewind', 'free_clue']) assert.equal((await f.request(mixedActivation(type))).status, 200)
  clock(660); await f.request()
  const control = (await (await f.control()).json()).data.teams[0]
  assert.equal(f.team().activeNum, 0)
  assert.equal(control.isActiveTaskFinished, false)
  assert.equal(control.isActiveTaskFailed, false)
  assert.equal(control.isTeamOnBreak, false)
  assert.equal(control.currentTaskSeconds, 300)
}))

test('API: после отката к нулю итог с бонусным кодом одинаков в Game Control и результатах', async () => withGameClock(async (clock, startedAt) => {
  const f = mixedFixture(startedAt, { breakDuration: 0 })
  f.game.tasks = [f.game.tasks[0]]
  f.game.tasks[0].bonusCodes = [{ code: 'bonus', bonus: 45 }]
  clock(300)
  assert.equal((await f.request(mixedActivation('time_rewind'))).status, 200)
  assert.equal((await f.request({ message: 'bonus', stageId: 'stage' })).status, 200)
  assert.equal((await f.request(mixedActivation('portal'))).status, 200)
  const computed = (await f.load('@server/buildGameResultComputed').default({ game: { ...f.game, dateEndFact: new Date(), result: { teams: [{ _id: 'team' }], teamsUsers: [{ teamId: 'team' }], gameTeams: [f.team()] } } })).computed.teams[0]
  const control = (await (await f.control()).json()).data.teams[0]
  assert.equal(computed.finalSeconds, -45)
  assert.equal(computed.taskResults[0].isFailedTask, false)
  assert.equal(control.teamProgressStats.totalFinalSeconds, computed.finalSeconds)
}))

test('API: слив задания без лимита после временных эффектов сохраняет штраф за провал', async () => withGameClock(async (clock, startedAt) => {
  const f = mixedFixture(startedAt, { taskDuration: 0, breakDuration: 0 })
  f.game.tasks = [f.game.tasks[0]]
  f.game.tasks[0].clues = []
  clock(600)
  for (const type of ['time_freeze', 'time_rewind', 'penalty_shield']) assert.equal((await f.request(mixedActivation(type))).status, 200)
  clock(650)
  assert.equal((await f.request({ action: 'failTask', stageId: 'stage' })).status, 200)
  const computed = (await f.load('@server/buildGameResultComputed').default({ game: { ...f.game, dateEndFact: new Date(), result: { teams: [{ _id: 'team' }], teamsUsers: [{ teamId: 'team' }], gameTeams: [f.team()] } } })).computed.teams[0]
  const control = (await (await f.control()).json()).data.teams[0]
  assert.equal(computed.failurePenaltySeconds, 180)
  assert.equal(computed.taskResults[0].isFailedTask, true)
  assert.equal(control.teamProgressStats.totalFinalSeconds, computed.finalSeconds)
  assert.equal(f.team().timeAddings[0].time, -50)
}))

test('API: сбой записи портала во время заморозки не расходует предмет; повтор сохраняет один исход', async () => withGameClock(async (clock, startedAt) => {
  const f = mixedFixture(startedAt, { breakDuration: 0 })
  clock(600)
  assert.equal((await f.request(mixedActivation('time_freeze'))).status, 200)
  clock(650)
  const before = structuredClone(f.team())
  let failOnce = true
  f.db.model('GamesTeams').failUpdate = (_filter, update) => {
    if (failOnce && update.$set?.classicProgress?.history?.some((entry) => entry.key === 'use-item:mixed-portal')) { failOnce = false; return true }
    return false
  }
  const originalError = console.error
  try { console.error = () => {}; assert.equal((await f.request(mixedActivation('portal'))).status, 500) }
  finally { console.error = originalError }
  assert.equal(f.team().activeNum, 0)
  assert.deepEqual(f.team().classicProgress, before.classicProgress)
  assert.deepEqual(f.team().timeAddings, before.timeAddings)
  assert.equal((await f.request(mixedActivation('portal'))).status, 200)
  assert.equal(f.team().activeNum, 1)
  assert.equal(f.team().timeAddings[0].time, -50)
  assert.equal(f.team().classicProgress.inventory.find((item) => item.itemId === 'portal').quantity, 2)
  assert.equal(f.team().classicProgress.history.filter((entry) => entry.type === 'stage_finished').length, 1)
}))

test('API: два ластика и щит не компенсируют один штраф повторно', async () => withGameClock(async (clock, startedAt) => {
  const f = mixedFixture(startedAt)
  clock(600)
  assert.equal((await f.request(mixedActivation('penalty_shield'))).status, 200)
  assert.equal((await f.request({ message: 'trap', stageId: 'stage' })).status, 200)
  assert.equal((await f.request(mixedActivation('penalty_erase', { penaltyKey: 'code:trap' }))).status, 409)
  assert.equal((await f.request({ message: 'trap2', stageId: 'stage' })).status, 200)
  const results = await Promise.all([
    f.request(mixedActivation('penalty_erase', { requestId: 'race-erase-one', penaltyKey: 'code:trap2' })),
    f.request(mixedActivation('penalty_erase', { requestId: 'race-erase-two', penaltyKey: 'code:trap2' })),
  ])
  assert.equal(results.filter((response) => response.status === 200).length, 1)
  assert.equal(f.team().timeAddings.filter((entry) => entry.scope === 'total_adjustment').reduce((sum, entry) => sum + entry.time, 0), -210)
  assert.equal(f.team().classicProgress.stages[0].waivedPenalties.length, 2)
  assert.equal(f.team().classicProgress.inventory.find((item) => item.itemId === 'penalty_erase').quantity, 2)
}))

test('API: остановка игры во время заморозки фиксирует использованный бонус и запрещает новые применения', async () => withGameClock(async (clock, startedAt) => {
  const f = mixedFixture(startedAt)
  clock(600)
  assert.equal((await f.request(mixedActivation('time_freeze'))).status, 200)
  clock(630)
  f.game.status = 'finished'; f.game.dateEndFact = new Date()
  const before = structuredClone(f.team().classicProgress)
  const snapshot = () => f.load('@server/buildGameResultComputed').default({ game: { ...f.game, result: { teams: [{ _id: 'team' }], teamsUsers: [{ teamId: 'team' }], gameTeams: [f.team()] } } })
  const first = await snapshot()
  assert.equal(first.computed.teams[0].taskResults[0].timeBonusSeconds, 30)
  clock(2000)
  assert.equal((await f.request(mixedActivation('portal'))).status, 409)
  const second = await snapshot()
  assert.equal(second.computed.teams[0].taskResults[0].timeBonusSeconds, 30)
  assert.equal(second.computed.teams[0].finalSeconds, first.computed.teams[0].finalSeconds)
  assert.deepEqual(f.team().classicProgress, before)
}))
