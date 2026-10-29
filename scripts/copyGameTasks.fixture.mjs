// Настоящие handlers и Mongoose casting; БД и серверная сессия контролируются тестом.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import path from 'node:path'
const require = createRequire(import.meta.url)
const mongoose = require('mongoose')
const swc = require('next/dist/build/swc')
await swc.loadBindings()
export function loader(mocks = {}) {
  const cache = new Map()
  function load(id) {
    if (Object.hasOwn(mocks, id)) return mocks[id]
    if (!id.startsWith('@') && !id.startsWith('/') && !id.startsWith('.')) return require(id)
    let filename = id.startsWith('@') ? path.join(process.cwd(), id.slice(1)) : id
    if (!path.extname(filename)) filename += '.js'
    if (cache.has(filename)) return cache.get(filename).exports
    const module = { exports: {} }; cache.set(filename, module)
    const { code } = swc.transformSync(readFileSync(filename, 'utf8'), { jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' } })
    new Function('require', 'module', 'exports', code)(child => load(child.startsWith('.') ? path.resolve(path.dirname(filename), child) : child), module, module.exports)
    return module.exports
  }
  return load
}
export const ids = { source: '111111111111111111111111', target: '222222222222222222222222', user: '333333333333333333333333', other: '444444444444444444444444' }
export const task = (id = 'aaaaaaaaaaaaaaaaaaaaaaaa', title = 'Первое') => ({ _id: id, stageKey: `stage-${id}`, title, taskRich: '<p><strong>Текст</strong></p>', codes: ['КОД'], codePhotos: ['https://cdn.test/code.jpg'], clues: [{ _id: 'bbbbbbbbbbbbbbbbbbbbbbbb', clue: 'Подсказка', clueRich: '<p>Подсказка</p>', images: ['https://cdn.test/clue.jpg'] }], subTasks: [{ _id: 'cccccccccccccccccccccccc', name: 'Фото', task: 'Сделать фото', bonus: 12 }], bonusCodes: [{ _id: 'dddddddddddddddddddddddd', code: 'БОНУС', bonus: 30 }], penaltyCodes: [{ _id: 'eeeeeeeeeeeeeeeeeeeeeeee', code: 'ШТРАФ', penalty: 60 }], coordinates: { latitude: 55, longitude: 92, radius: 30 }, taskMedia: [{ id: 'media-old', type: 'audio', url: 'https://cdn.test/a.mp3' }], agentUserIds: [ids.other] })
const clone = value => value == null ? value : JSON.parse(JSON.stringify(value))
export function fixture() {
  let session = { user: { id: ids.user, role: 'admin', name: 'Проверка' } }
  const docs = [ { _id: ids.source, name: 'Источник', location: 'krsk', type: 'classic', status: 'closed', creatorUserId: ids.user, tasks: [task(), task('ffffffffffffffffffffffff', 'Второе')] }, { _id: ids.target, name: 'Назначение', location: 'krsk', type: 'classic', status: 'active', creatorUserId: ids.user, tasks: [task('999999999999999999999999', 'Существующее')], taskDuration: 123, agents: [] } ]
  const teams = [], writes = [], history = []
  let beforeWrite = null, failHistory = false
  const val = (expr, doc) => typeof expr === 'string' && expr.startsWith('$') ? expr === '$$ROOT' ? doc : doc[expr.slice(1)] : expr?.$literal !== undefined ? expr.$literal : expr?.$ifNull ? val(expr.$ifNull[0], doc) ?? expr.$ifNull[1] : expr
  const matches = (doc, filter) => Object.entries(filter).every(([key, value]) => key === '$expr' ? value.$and.every(rule => { const [a, b] = rule.$eq; return JSON.stringify(val(a, doc)) === JSON.stringify(val(b, doc)) }) : value?.$ne !== undefined ? String(doc[key]) !== String(value.$ne) : String(doc[key]) === String(value))
  const collection = list => ({
    findOne: async filter => clone(list.find(doc => matches(doc, filter))),
    find: filter => ({ toArray: async () => clone(list.filter(doc => matches(doc, filter))) }),
    async findOneAndUpdate(filter, update, options = {}) {
      if (beforeWrite) { const fn = beforeWrite; beforeWrite = null; await fn() }
      const doc = list.find(doc => matches(doc, filter)); if (!doc) return null
      assert.ok(update.$push || update.$set)
      for (const [key, value] of Object.entries(update.$push || {})) (doc[key] ||= []).push(...clone(value.$each || [value]))
      for (const [key, value] of Object.entries(update.$set || {})) {
        if (key === 'taskCopyOperations.$[operation].completed') doc.taskCopyOperations.filter(entry => entry.id === options.arrayFilters?.[0]?.['operation.id']).forEach(entry => { entry.completed = value })
        else doc[key] = clone(value)
      }
      writes.push({ filter, update }); return clone(doc)
    },
  })
  const load = loader({ 'next/server': { NextResponse: Response }, 'next-auth': { getServerSession: async () => session }, '@server/auth/authOptions': { authOptions: {} }, '@utils/dbConnectGlobal': async () => db,
    '@server/gameHistory/fetchGameHistoryState': async ({ game }) => ({ game, gameTeams: clone(teams) }),
    '@server/gameHistory/recordGameHistoryEntry': async entry => { if (failHistory) throw new Error('history unavailable'); if (!history.some(h => h.entryId === entry.entryId)) history.push(entry); return { _id: entry.entryId } },
  })
  const Games = mongoose.models.CopyTasksFixture || mongoose.model('CopyTasksFixture', new mongoose.Schema(load('@schemas/gamesSchema').default, { timestamps: true }))
  Games.collection = collection(docs)
  const db = { model: name => name === 'Games' ? Games : name === 'GamesTeams' ? { collection: collection(teams) } : assert.fail(`Неожиданная модель ${name}`) }
  return { docs, teams, history, writes, load, Games, role(role, id = ids.user, extra = {}) { session = role ? { user: { id, role, ...extra } } : null }, race(fn) { beforeWrite = fn }, failHistory(value) { failHistory = value }, api: () => load('@app/api/cabinet/games/[gameId]/copy-tasks/route') }
}
export const context = { params: Promise.resolve({ gameId: ids.source }) }
export const input = (extra = {}) => ({ targetGameId: ids.target, taskIds: ['ffffffffffffffffffffffff', 'aaaaaaaaaaaaaaaaaaaaaaaa'], requestId: 'copy-request-0001', ...extra })
export const req = (body = input(), method = 'POST') => new Request('http://localhost/api/cabinet/games/'+ids.source+'/copy-tasks', { method, ...(method === 'POST' ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) })
