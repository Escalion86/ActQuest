// Изолированный прогон сохранённой classic-игры на локальной MongoDB.
// Исходная БД только читается. Уведомления отключены, время виртуальное.
import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import mongoose from 'mongoose'
import { MongoClient, ObjectId, BSON } from 'mongodb'

const require = createRequire(import.meta.url)
require('@next/env').loadEnvConfig(process.cwd())
const swc = require('next/dist/build/swc')
await swc.loadBindings()
const gameId = process.argv[2]
assert.match(gameId || '', /^[a-f\d]{24}$/i, 'Передайте ID игры')
const uri = process.env.MONGODB_URI || ''
assert.match(uri, /^mongodb:\/\/(?:[^@/]+@)?(?:127\.0\.0\.1|localhost):?\d*\//, 'Разрешена только локальная MongoDB')
const scratchName = `actquest_sim_${randomUUID().replaceAll('-', '')}`
assert.notEqual(scratchName, process.env.MONGODB_GLOBAL_DBNAME)
let now = Date.now()
class GameDate extends Date {
  constructor(...args) { super(...(args.length ? args : [now])) }
  static now() { return now }
}
const advance = seconds => { now += seconds * 1000 }
const together = async promises => {
  const results = await Promise.allSettled(promises)
  const failure = results.find(result => result.status === 'rejected')
  if (failure) throw failure.reason
  return results.map(result => result.value)
}
const wrap = fn => ({ __esModule: true, default: fn })
let db
const mocks = {
  '@utils/dbConnectGlobal': wrap(async () => db),
  'telegram/sendMessage': wrap(async () => {}),
  '@server/agentNotifications': { notifyAgentsForGameTeamProgress: async () => {} },
  '@server/gameTestRuns': {},
}
const cache = new Map()
function load(id) {
  if (Object.hasOwn(mocks, id)) return mocks[id]
  const local = id.startsWith('@') || id.startsWith('telegram/') || path.isAbsolute(id)
  if (!local) return require(id)
  let filename = path.isAbsolute(id) ? id : path.resolve(id.replace(/^@/, ''))
  if (!path.extname(filename)) filename += '.js'
  if (cache.has(filename)) return cache.get(filename).exports
  const mod = { exports: {} }
  cache.set(filename, mod)
  const { code } = swc.transformSync(readFileSync(filename, 'utf8'), {
    filename, jsc: { parser: { syntax: 'ecmascript', jsx: true } }, module: { type: 'commonjs' },
  })
  new Function('require', 'module', 'exports', 'Date', code)(
    child => load(child.startsWith('.') ? path.resolve(path.dirname(filename), child) : child),
    mod, mod.exports, filename.includes(`${path.sep}schemas${path.sep}`) ? Date : GameDate,
  )
  return mod.exports
}
const source = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 })
const digest = value => createHash('sha256').update(BSON.EJSON.stringify(value)).digest('hex')
let sourceDigest
const report = { gameId, checks: [], routes: [] }
const check = name => { report.checks.push(name); console.log(`OK: ${name}`) }
let readSource
try {
  await source.connect()
  const original = source.db(process.env.MONGODB_GLOBAL_DBNAME)
  readSource = async () => ({
    game: await original.collection('games').findOne({ _id: new ObjectId(gameId) }),
    registrations: await original.collection('gamesteams').find({ gameId }).sort({ _id: 1 }).toArray(),
  })
  const snapshot = await readSource()
  sourceDigest = digest(snapshot)
  const game = snapshot.game
  assert.ok(game, 'Игра не найдена')
  assert.equal(game.type, 'classic')
  assert.equal(game.status, 'active', 'Прогон предназначен для предстоящей игры')
  assert.deepEqual(game.taskDistributionTemplate[0], [0, 1, 2])
  assert.equal(load('@helpers/classicVariants').hasClassicVariants(game), false)
  report.name = game.name
  report.teamsCount = snapshot.registrations.length
  report.tasksCount = game.tasks.length
  report.captainCanFailTask = game.allowCaptainFailTask !== false
  report.template = game.taskDistributionTemplate.map(block => block.map(i => i + 1))
  db = await mongoose.createConnection(uri, { dbName: scratchName, autoIndex: false }).asPromise()
  for (const [name, schema] of Object.entries({ Games: 'gamesSchema', GamesTeams: 'gamesTeamsSchema', Teams: 'teamsSchema', TeamsUsers: 'teamsUsersSchema', LastCommands: 'lastCommandsSchema', Users: 'usersSchema' })) {
    db.model(name, new mongoose.Schema(load(`@schemas/${schema}`).default, { timestamps: true, autoIndex: false }))
  }
  const Games = db.model('Games'), GT = db.model('GamesTeams'), Teams = db.model('Teams'), TU = db.model('TeamsUsers')
  await Games.collection.insertOne(game)
  const teamIds = snapshot.registrations.map(row => new ObjectId(row.teamId))
  const originals = await original.collection('teams').find({ _id: { $in: teamIds } }).toArray()
  await Teams.collection.insertMany(originals)
  await GT.collection.insertMany(snapshot.registrations)
  const actor = String(new ObjectId())
  mocks['next/server'] = { NextResponse: Response }
  mocks['next-auth'] = { getServerSession: async () => ({ user: { id: actor, role: 'dev' } }) }
  mocks['@server/auth/authOptions'] = { authOptions: {} }
  mocks['@server/gameTeamMessages'] = { fetchUnreadTeamMessageCounts: async () => ({}) }
  // Фиктивный капитан без телефона/Telegram и без реальных участников.
  await TU.collection.insertMany(teamIds.map(id => ({ teamId: String(id), userId: actor, role: 'captain' })))
  const start = load('@server/gameStart').default
  const state = load('@server/getTeamGameTaskState').default
  const buildResult = load('@server/buildGameResultComputed').default
  const distribution = load('@helpers/taskDistribution')
  const rules = load('@helpers/classicGameRules')
  const adminStatus = load('@app/api/cabinet/admin/game-status/route').GET
  const distribute = load('@app/api/cabinet/admin/task-distribution/route').POST
  const balancedCounts = rows => [0, 1, 2].map(step => {
    const counts = [0, 1, 2].map(task => rows.filter(row => row.taskSequence[step] === task).length)
    assert.ok(Math.max(...counts) - Math.min(...counts) <= 1, `Неравномерное распределение на шаге ${step + 1}: ${counts}`)
    return counts
  })
  const distributed = await distribute(new Request('http://localhost/api/cabinet/admin/task-distribution', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gameId }),
  }))
  assert.equal(distributed.status, 200)
  const manualRows = await GT.find({ gameId }).lean()
  report.manualCountsByStep = balancedCounts(manualRows)
  check('Ручное распределение: баланс на каждом из первых трёх шагов')
  const single = await distribute(new Request('http://localhost/api/cabinet/admin/task-distribution', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gameId, teamId: manualRows[0].teamId }),
  }))
  assert.equal(single.status, 200)
  const singleRows = await GT.find({ gameId }).lean()
  balancedCounts(singleRows)
  for (const row of manualRows.slice(1)) assert.deepEqual(singleRows.find(item => item.teamId === row.teamId).taskSequence, row.taskSequence)
  check('Распределение одной команды учитывает остальных и не меняет их маршруты')
  // Только временная БД: очищаем ручное распределение для отдельной проверки старта.
  await GT.updateMany({ gameId }, { $set: { taskSequence: [] } })
  const admin = async () => {
    const response = await adminStatus(new Request(`http://localhost/api/cabinet/admin/game-status?gameId=${gameId}`))
    const json = await response.json()
    assert.equal(json.success, true, JSON.stringify(json.error))
    assert.equal(json.data.taskDistributionMode, 'random', 'Game Control должен знать случайный режим игры')
    return json.data
  }
  const result = await start({ jsonCommand: { gameId, confirm: true }, location: game.location, db })
  assert.notEqual(result.success, false, JSON.stringify(result))
  assert.equal((await Games.findById(gameId).lean()).status, 'started')
  let rows = await GT.find({ gameId }).lean()
  const initialRows = rows.map(row => BSON.EJSON.parse(BSON.EJSON.stringify(row)))
  for (const row of rows) {
    assert.equal(distribution.isTaskSequenceCompatibleWithTemplate(row.taskSequence, game.taskDistributionTemplate, game.tasks.length), true)
    assert.ok(row.startTime[row.taskSequence[0]])
    assert.equal(row.startTime.filter(Boolean).length, 1)
    report.routes.push({ team: originals.find(t => String(t._id) === row.teamId)?.name, order: row.taskSequence.map(i => i + 1) })
  }
  check(`Реальный старт: маршруты и начальные таймеры ${rows.length} команд`)
  report.startCounts = [0, 1, 2].map(index => rows.filter(row => row.taskSequence[0] === index).length)
  report.startCountsByStep = balancedCounts(rows)
  check('Автоматический старт: баланс на каждом из первых трёх шагов')
  const adminInitial = await admin()
  for (const row of rows) {
    assert.equal(adminInitial.teams.find(team => team.teamId === row.teamId).activeTaskIndex, row.taskSequence[0])
  }
  check('Game Control показывает правильные стартовые задания')
  const request = async (row, extra = {}) => {
    const response = await state({ location: game.location, gameId, teamId: row.teamId, userId: actor, ...extra })
    assert.equal(response.success, true, JSON.stringify(response.error))
    return response.data
  }
  const current = row => GT.findById(row._id).lean()
  const verifyScreen = async (row, index) => {
    const screen = await request(row)
    assert.equal(screen.taskDisplayMeta.taskIndex, index, 'Экран должен показывать индекс исходного задания')
    assert.equal(screen.taskState, 'active')
    return screen
  }
  const submitTask = async (row, index) => {
    const codes = [...new Set(game.tasks[index].codes.map(rules.normalizeClassicCode).filter(Boolean))]
    for (const code of codes.slice(0, rules.resolveRequiredMainCodesCount(game.tasks[index]))) {
      await request(row, { message: code })
    }
    const saved = await current(row)
    assert.ok(saved.endTime[index], `Задание ${index + 1} не завершилось`)
    assert.ok(saved.findedCodes[index].length)
  }
  // Проверяем каждый шаг одновременно у всех зарегистрированных команд.
  for (let step = 0; step < game.tasks.length; step++) {
    advance(60)
    await together(rows.map(async row => {
      const index = row.taskSequence[step]
      await verifyScreen(row, index)
      await submitTask(row, index)
      const saved = await current(row)
      assert.deepEqual(saved.taskSequence, row.taskSequence)
      if (step < game.tasks.length - 1 && game.breakDuration > 0) {
        assert.equal((await request(row)).taskState, 'break')
        assert.equal(saved.activeNum, step)
      }
    }))
    advance(game.breakDuration + 1)
    await together(rows.map(row => request(row)))
    check(`Все команды прошли шаг ${step + 1}/${game.tasks.length}`)
  }
  for (const row of rows) {
    const saved = await current(row)
    assert.equal(saved.activeNum, game.tasks.length)
    assert.equal(saved.endTime.filter(Boolean).length, game.tasks.length)
  }
  const computed = await buildResult({ game: { ...game, status: 'finished', result: {
    teams: originals, gameTeams: await GT.find({ gameId }).lean(), teamsUsers: await TU.find({}).lean(),
  } } })
  assert.equal(computed.computed.teams.length, rows.length)
  assert.ok(computed.computed.teams.every(team => Number.isFinite(team.finalSeconds)))
  for (const team of computed.computed.teams) {
    assert.deepEqual(team.taskSequence, rows.find(row => row.teamId === team.teamId).taskSequence)
    assert.ok(team.taskResults.every(task => Number.isFinite(task.seconds)))
  }
  check('Полное завершение и расчёт итогов всех команд')
  // Все перестановки проверяются независимо от случайного исхода старта.
  const permutations = [[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]]
  const base = initialRows[0]
  for (const order of permutations) {
    const sequence = [...order, ...base.taskSequence.slice(3)]
    const reset = async () => {
      const row = BSON.EJSON.parse(BSON.EJSON.stringify(base))
      row.taskSequence = sequence
      row.startTime = Array(game.tasks.length).fill(null)
      row.startTime[sequence[0]] = new Date(now)
      await GT.collection.replaceOne({ _id: row._id }, row)
      return row
    }
    let row = await reset()
    const foreignCode = game.tasks[order[1]].codes.find(code => !game.tasks[order[0]].codes.map(rules.normalizeClassicCode).includes(rules.normalizeClassicCode(code)))
    assert.ok(foreignCode, 'Для проверки нужен код другого задания')
    await request(row, { message: foreignCode })
    assert.equal((await current(row)).findedCodes[order[0]].length, 0)
    check(`Код другого задания не принят для ${order.map(i => i + 1).join('→')}`)
    for (let step = 0; step < 3; step++) {
      await verifyScreen(row, sequence[step])
      advance(30)
      await submitTask(row, sequence[step])
      const adminBreak = (await admin()).teams.find(team => team.teamId === row.teamId)
      assert.equal(adminBreak.activeTaskIndex, sequence[step])
      assert.equal(adminBreak.isTeamOnBreak, true)
      advance(game.breakDuration + 1)
      // Переход выполняет открытый Game Control, затем проверяем экран игрока.
      const adminNext = (await admin()).teams.find(team => team.teamId === row.teamId)
      assert.equal(adminNext.activeTaskIndex, sequence[step + 1])
      await request(row)
    }
    await verifyScreen(row, 3)
    check(`Перестановка ${order.map(i => i + 1).join('→')} → 4`)
    row = await reset()
    advance(game.taskDuration + 1)
    assert.equal((await request(row)).taskState, 'break')
    assert.equal((await current(row)).endTime[order[0]], null)
    advance(game.breakDuration)
    await verifyScreen(row, order[1])
    check(`Таймаут первого задания для ${order.map(i => i + 1).join('→')}`)
    if (game.allowCaptainFailTask !== false) {
      row = await reset()
      await request(row, { action: 'failTask' })
      assert.equal((await request(row)).taskState, 'break')
      assert.equal((await current(row)).endTime[order[0]], null)
      advance(game.breakDuration + 1)
      await verifyScreen(row, order[1])
      check(`Слив первого задания для ${order.map(i => i + 1).join('→')}`)
    }
    row = await reset()
    const code = game.tasks[order[0]].codes[0]
    await together(Array.from({ length: 8 }, () => request(row, { message: code })))
    const saved = await current(row)
    assert.equal(saved.findedCodes[order[0]].filter(c => c === rules.normalizeClassicCode(code)).length, 1)
    assert.ok(saved.findedCodes.every((codes, i) => i === order[0] || !codes.length))
    assert.deepEqual(saved.taskSequence, sequence)
    check(`8 одновременных одинаковых ответов для ${order.map(i => i + 1).join('→')}`)
  }
  console.log(JSON.stringify(report, null, 2))
} finally {
  if (db) {
    assert.equal(db.name, scratchName)
    assert.match(db.name, /^actquest_sim_[a-f0-9]{32}$/)
    await db.dropDatabase()
    await db.close()
    console.log('Временная БД удалена')
  }
  try {
    if (sourceDigest) {
      assert.equal(digest(await readSource()), sourceDigest, 'Исходная игра или регистрации изменились')
      console.log('Исходная игра и регистрации не изменены')
    }
  } finally { await source.close() }
}
