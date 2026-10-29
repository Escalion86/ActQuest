import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import { fixture } from './actquestAssistantCity.test.mjs'
import { renderToStaticMarkup } from 'react-dom/server'
import { handleAssistant, createLimiter } from '../server/assistant/gateway.mjs'
const req = (question = 'Чем отличаются форматы игр?', extra = {}) => new Request('http://localhost/api/assistant', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ city: 'krsk', question, ...extra }) })
const options = (extra = {}) => ({ limiter: createLimiter(), apiKey: 'fixture', readAiSettings: async () => ({ assistantAiEnabled: false }), readGames: async () => ({ available: true, games: [] }), generate: () => { throw new Error('Модель запрещена') }, ...extra })
for (const value of [false, undefined, null, 'true', 1]) test(`ИИ OFF: строгий флаг ${value}, без резерва и модели`, async () => {
  let reserves = 0
  const response = await handleAssistant(req(), options({ readAiSettings: async () => ({ assistantAiEnabled: value }), limiter: { acquire: () => ({ ok: true, reserve: () => { reserves++; return true }, release() {} }) } }))
  assert.equal(response.status, 403); assert.equal((await response.json()).code, 'ASSISTANT_AI_DISABLED'); assert.equal(reserves, 0)
})
test('ошибка чтения настроек закрывает свободные вопросы', async () => {
  assert.equal((await handleAssistant(req(), options({ readAiSettings: async () => { throw new Error('DB') } }))).status, 403)
})
for (const question of ['регистрация и напиши историю', 'Подробнее расскажи про космос', 'расписание футбола', 'Что за погода?']) test(`OFF только точные вопросы: ${question}`, async () => assert.equal((await handleAssistant(req(question), options())).status, 403))
for (const question of ['Что такое автоквест?', 'Какие ближайшие игры?', 'Как записаться?', 'Можно участвовать без команды?', 'Как подготовиться?', 'Как связаться с организатором?', 'Подробнее об игре', 'Хочу записаться']) test(`OFF быстрый ответ без ключа: ${question}`, async () => {
  const response = await handleAssistant(req(question), options({ apiKey: '' })); assert.equal(response.status, 200); assert.ok(['faq', 'no-data'].includes((await response.json()).mode))
})
for (const field of ['assistantAiEnabled', 'session', 'user']) test(`подделка ${field} не открывает ИИ`, async () => assert.equal((await handleAssistant(req(undefined, { [field]: true }), options())).status, 400))
test('ON вызывает модель, следующий OFF блокирует старый клиент', async () => {
  let enabled = true, calls = 0
  const opts = options({ readAiSettings: async () => ({ assistantAiEnabled: enabled }), generate: async () => { calls++; return { choices: [{ message: { content: '{"sourceIds":["about"]}' } }] } } })
  assert.equal((await (await handleAssistant(req(), opts)).json()).mode, 'ai'); enabled = false
  assert.equal((await handleAssistant(req(), opts)).status, 403); assert.equal(calls, 1)
})
async function routeFixture() {
  const require = createRequire(import.meta.url), swc = require('next/dist/build/swc'); await swc.loadBindings()
  const source = await readFile(new URL('../app/api/cabinet/settings/route.js', import.meta.url), 'utf8')
  const { code } = await swc.transform(source, { jsc: { parser: { syntax: 'ecmascript' } }, module: { type: 'commonjs' } })
  let session = null, doc = { _id: 'settings', allowSiteAuth: true, supportPhone: 'keep', assistantAiEnabled: true }, updates = []
  const model = { findOne: () => ({ lean: async () => ({ ...doc }) }), findByIdAndUpdate: (_id, update) => { updates.push(update); Object.assign(doc, update.$set); return { lean: async () => ({ ...doc }) } } }
  const module = { exports: {} }
  new Function('require', 'module', 'exports', code)(id => id === 'next/server' ? { NextResponse: Response } : id === 'next-auth' ? { getServerSession: async () => session } : id.includes('authOptions') ? { authOptions: {} } : id.includes('dbConnectGlobal') ? async () => ({ model: () => model }) : id.includes('normalizeSiteSettings') ? value => value : require(id), module, module.exports)
  return { route: module.exports, role: role => { session = role ? { user: { role } } : null }, doc: () => doc, updates }
}
for (const role of [null, 'client', 'admin', 'dev']) test(`PATCH dev-only ${role}`, async () => {
  const f = await routeFixture(); f.role(role); assert.equal(typeof f.route.PATCH, 'function')
  const response = await f.route.PATCH(new Request('http://localhost/api/cabinet/settings', { method: 'PATCH', body: JSON.stringify({ assistantAiEnabled: false }) }))
  assert.equal(response.status, role === 'dev' ? 200 : role ? 403 : 401)
  if (role === 'dev') { assert.equal(f.doc().assistantAiEnabled, false); assert.equal(f.doc().allowSiteAuth, true); assert.equal(f.doc().supportPhone, 'keep'); assert.deepEqual(f.updates, [{ $set: { assistantAiEnabled: false } }]) } else assert.equal(f.updates.length, 0)
})
for (const value of ['true', 1, null, undefined]) test(`PATCH отклоняет не boolean ${value}`, async () => {
  const f = await routeFixture(); f.role('dev'); assert.equal(typeof f.route.PATCH, 'function')
  const response = await f.route.PATCH(new Request('http://localhost', { method: 'PATCH', body: JSON.stringify({ assistantAiEnabled: value }) })); assert.equal(response.status, 400); assert.equal(f.updates.length, 0)
})
test('PUT admin не может менять новое поле', async () => {
  const f = await routeFixture(); f.role('admin')
  const r = await f.route.PUT(new Request('http://localhost', { method: 'PUT', body: JSON.stringify({ assistantAiEnabled: true }) })); assert.equal(r.status, 403); assert.equal(f.updates.length, 0)
})
test('dev UI: использует существующий переключатель и отправляет только boolean PATCH', async () => {
  const require = createRequire(import.meta.url), swc = require('next/dist/build/swc'); await swc.loadBindings()
  const source = await readFile(new URL('../components/cabinet/AssistantAiSetting.js', import.meta.url), 'utf8')
  const { code } = await swc.transform(source, { jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' } })
  const states = [], effects = []; let slot = 0
  const hooks = { ...require('react'), useState: value => { const i = slot++; if (!(i in states)) states[i] = value; return [states[i], v => { states[i] = v }] }, useEffect: fn => effects.push(fn) }
  const module = { exports: {} }
  new Function('require', 'module', 'exports', code)(name => name === 'react' ? hooks : name.includes('NeonCheckbox') ? props => require('react').createElement('input', { type: 'checkbox', ...props }) : require(name), module, module.exports)
  const render = () => { slot = 0; return module.exports.default() }
  let tree = render(); const checkbox = () => nodes(tree).find(n => n.props?.label === 'ИИ в помощнике')
  assert.equal(checkbox().props.checked, false); assert.equal(checkbox().props.disabled, true)
  const original = globalThis.fetch; const requests = []
  globalThis.fetch = async (url, options) => { requests.push([url, options]); return { ok: true, json: async () => ({ success: true, data: { assistantAiEnabled: true } }) } }
  try {
    await effects[0]()
    await new Promise(resolve => setImmediate(resolve)); tree = render()
    assert.equal(checkbox().props.checked, true); assert.equal(checkbox().props.disabled, false)
    await checkbox().props.onChange({ target: { checked: false } })
    assert.equal(requests.at(-1)[0], '/api/cabinet/settings'); assert.equal(requests.at(-1)[1].method, 'PATCH'); assert.deepEqual(JSON.parse(requests.at(-1)[1].body), { assistantAiEnabled: false })
    assert.match(source, /Готовая помощь/)
  } finally { globalThis.fetch = original }
})
const nodes = tree => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(nodes) : [tree, ...nodes(tree.props?.children)]
test('UI OFF/loading: нет формы, guard блокирует прямой свободный вопрос', async () => {
  const f = await fixture(); f.open(); const tree = f.panel('krsk')
  assert.equal(nodes(tree).filter(n => n.type === 'textarea' || n.type === 'form').length, 0)
  assert.match(renderToStaticMarkup(tree), /Выберите вопрос из списка/)
  const original = globalThis.fetch; let calls = 0
  globalThis.fetch = async () => { calls++; return { ok: true, json: async () => ({ success: true }) } }
  try { await f.ask('Чем отличаются форматы игр?'); assert.equal(calls, 0) } finally { globalThis.fetch = original }
})
test('UI: ON подтверждается GET; refresh OFF и отказ POST убирают форму/черновик', async () => {
  const originalFetch = globalThis.fetch, originalWindow = globalThis.window, originalInterval = globalThis.setInterval, originalClear = globalThis.clearInterval
  const events = {}; let tick, enabled = true, fail = false, calls = 0
  globalThis.window = { addEventListener: (name, fn) => { events[name] = fn }, removeEventListener: name => { delete events[name] } }
  globalThis.setInterval = (fn, delay) => { assert.equal(delay, 30000); tick = fn; return 123 }
  globalThis.clearInterval = id => assert.equal(id, 123)
  globalThis.fetch = async (url, opts) => {
    calls++
    if (url === '/api/assistant/settings') { assert.equal(opts.cache, 'no-store'); if (fail) throw new Error('network'); return { ok: true, json: async () => ({ assistantAiEnabled: enabled }) } }
    return { ok: false, json: async () => ({ success: false, code: 'ASSISTANT_AI_DISABLED', error: 'Выберите вопрос из списка' }) }
  }
  let cleanup
  try {
    const f = await fixture(); f.open(); f.panel(null); cleanup = f.settingsEffect()
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(calls, 1); assert.equal(nodes(f.panel(null)).some(n => n.type === 'form'), false)
    // Выбираем город, настройка уже достоверно ON.
    nodes(f.panel(null)).find(n => n.props?.['data-assistant-city'] === 'krsk').props.onClick()
    let tree = f.panel(null); assert.equal(nodes(tree).filter(n => n.type === 'textarea').length, 1)
    nodes(tree).find(n => n.type === 'textarea').props.onChange({ target: { value: 'Черновик' } })
    enabled = false; await tick(); tree = f.panel(null); assert.equal(nodes(tree).some(n => n.type === 'form'), false)
    enabled = true; await events.focus(); tree = f.panel(null); assert.equal(nodes(tree).find(n => n.type === 'textarea').props.value, '')
    await f.ask('Чем отличаются форматы игр?'); tree = f.panel(null); assert.equal(nodes(tree).some(n => n.type === 'form'), false)
    await events.focus(); fail = true; await tick(); assert.equal(nodes(f.panel(null)).some(n => n.type === 'form'), false)
  } finally { cleanup?.(); globalThis.fetch = originalFetch; globalThis.window = originalWindow; globalThis.setInterval = originalInterval; globalThis.clearInterval = originalClear }
})
test('публичный GET: только boolean, no-store, без параметров клиента', async () => {
  const require = createRequire(import.meta.url), swc = require('next/dist/build/swc'); await swc.loadBindings()
  const source = await readFile(new URL('../app/api/assistant/settings/route.js', import.meta.url), 'utf8')
  const { code } = await swc.transform(source, { jsc: { parser: { syntax: 'ecmascript' } }, module: { type: 'commonjs' } })
  const settingsSource = await readFile(new URL('../server/assistant/settings.mjs', import.meta.url), 'utf8')
  const settingsCode = (await swc.transform(settingsSource, { jsc: { parser: { syntax: 'ecmascript' } }, module: { type: 'commonjs' } })).code
  let enabled = false
  class Client {
    db() { return { collection: () => ({ findOne: async () => ({ assistantAiEnabled: enabled, contact: 'secret' }) }) } }
    async close() {}
  }
  const settings = { exports: {} }
  new Function('require', 'module', 'exports', 'process', settingsCode)(() => ({ MongoClient: Client }), settings, settings.exports, { env: { MONGODB_URI: 'fixture', MONGODB_GLOBAL_DBNAME: 'fixture' } })
  const module = { exports: {} }
  new Function('require', 'module', 'exports', code)(() => settings.exports, module, module.exports)
  for (const value of [true, false, undefined, 'true']) {
    enabled = value
    const response = await module.exports.GET(new Request('http://localhost/api/assistant/settings?assistantAiEnabled=true'))
    assert.equal(response.headers.get('cache-control'), 'no-store'); assert.deepEqual(await response.json(), { assistantAiEnabled: value === true })
  }
})
test('неверная конфигурация MongoDB закрывает GET безопасно', async () => {
  const { readAiSettings } = await import('../server/assistant/settings.mjs')
  assert.deepEqual(await readAiSettings(undefined, { uri: 'invalid', dbName: 'fixture' }), { assistantAiEnabled: false })
})
test('read-only настройки: projection, strict boolean, missing/DB failure OFF', async () => {
  const { readAiSettings, AI_SETTINGS_PROJECTION } = await import('../server/assistant/settings.mjs')
  assert.deepEqual(AI_SETTINGS_PROJECTION, { _id: 0, assistantAiEnabled: 1 })
  for (const value of [true, false, 'true', null, undefined]) {
    let closed = false
    class Client {
      db(name) { assert.equal(name, 'fixture'); return { collection: name => { assert.equal(name, 'sitesettings'); return { findOne: async (filter, opts) => { assert.deepEqual(filter, {}); assert.deepEqual(opts.projection, AI_SETTINGS_PROJECTION); return { assistantAiEnabled: value, secret: 'hidden' } } } } } }
      async close() { closed = true }
    }
    assert.deepEqual(await readAiSettings(undefined, { MongoClient: Client, uri: 'fixture', dbName: 'fixture' }), { assistantAiEnabled: value === true }); assert.equal(closed, true)
  }
  class Broken { db() { throw new Error('DB') } async close() {} }
  assert.deepEqual(await readAiSettings(undefined, { MongoClient: Broken, uri: 'fixture', dbName: 'fixture' }), { assistantAiEnabled: false })
  assert.deepEqual(await readAiSettings(undefined, { uri: '', dbName: '' }), { assistantAiEnabled: false })
})
