import test from 'node:test'
import assert from 'node:assert/strict'
import normalizeGameForCabinet from '../helpers/normalizeGameForCabinet.js'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { registerHooks, createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { resolveGameScheduleCountdown, formatScheduleCountdown } from '../helpers/gameScheduleCountdown.js'

registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@helpers/')) return nextResolve(new URL(`../helpers/${specifier.slice(9)}.js`, import.meta.url).href, context)
  if (specifier.startsWith('./') && context.parentURL && !context.parentURL.includes('/node_modules/')) {
    const url = new URL(`${specifier}.js`, context.parentURL)
    if (existsSync(fileURLToPath(url))) return nextResolve(url.href, context)
  }
  return nextResolve(specifier, context)
} })

const dateEnd = '2026-10-06T16:00:00.000Z'
test('плановое окончание сохраняется при нормализации и очищается явно', () => {
  assert.equal(normalizeGameForCabinet({ dateEnd }).dateEnd, dateEnd)
  assert.equal(normalizeGameForCabinet({ dateEnd: null }).dateEnd, null)
})
test('схема сохраняет необязательное плановое окончание отдельно от фактического', async () => {
  const source = readFileSync(new URL('../schemas/gamesSchema.js', import.meta.url), 'utf8')
  assert.match(source, /dateEnd:\s*\{\s*type: Date,\s*default: null/)
})
test('поле планового окончания присутствует в форме и payload сохранения', () => {
  const form = readFileSync(new URL('../components/modals/game-edit/sections/GameBasicInfoSection.js', import.meta.url), 'utf8')
  const client = readFileSync(new URL('../components/cabinet/app-router/GamesPageClient.js', import.meta.url), 'utf8')
  assert.match(form, /id="game-date-end"/)
  assert.match(client, /dateEnd: game.dateEnd/)
})

test('отсчёт выбирается по статусу, истечение не меняет игру', async () => {
  const { resolveGameScheduleCountdown, formatScheduleCountdown } = await import('../helpers/gameScheduleCountdown.js')
  const now = Date.parse('2026-10-06T15:00:00Z')
  const game = { status: 'active', dateStart: '2026-10-06T15:10:00Z', dateEnd }
  assert.equal(resolveGameScheduleCountdown(game, now).seconds, 600)
  assert.equal(resolveGameScheduleCountdown(game, now).label, 'До начала игры')
  game.status = 'started'
  assert.equal(resolveGameScheduleCountdown(game, now).seconds, 3600)
  assert.equal(resolveGameScheduleCountdown(game, now).label, 'До конца игры')
  assert.equal(resolveGameScheduleCountdown(game, now + 7200000).seconds, 0)
  assert.equal(game.status, 'started')
  assert.equal(formatScheduleCountdown(0), '00:00:00')
  assert.equal(formatScheduleCountdown(90061), '25:01:01')
  for (const status of ['finished', 'closed', 'canceled']) {
    assert.equal(resolveGameScheduleCountdown({ ...game, status }, now), null)
  }
  for (const dateEnd of [null, '', 'не дата']) {
    assert.equal(resolveGameScheduleCountdown({ ...game, dateEnd }, now), null)
  }
  assert.equal(resolveGameScheduleCountdown({ status: 'active', dateStart: null }, now), null)
})

test('живой таймер остаётся на нуле и не вызывает остановку игры', async () => {
  const { resolveGameScheduleCountdown, formatScheduleCountdown } = await import('../helpers/gameScheduleCountdown.js')
  const source = readFileSync(new URL('../components/location-game/GameScheduleCountdown.js', import.meta.url), 'utf8')
  const start = source.indexOf('  useEffect(() => {')
  const end = source.indexOf('\n  }, [', start)
  const body = source.slice(start + '  useEffect(() => {'.length, end)
  let tick
  let now = 10000
  const node = { textContent: '' }
  const game = { status: 'started', dateEnd: new Date(12000).toISOString() }
  const countdown = resolveGameScheduleCountdown(game, now)
  vm.runInNewContext(`(function(){${body}\n})()`, {
    valueRef: { current: node }, countdown, game,
    Date: { now: () => now, parse: Date.parse },
    formatScheduleCountdown,
    window: { setInterval: (fn) => { tick = fn; return 1 }, clearInterval: () => {} },
  })
  assert.equal(node.textContent, '00:00:02')
  now += 1000; tick()
  assert.equal(node.textContent, '00:00:01')
  now += 1000; tick()
  assert.equal(node.textContent, '00:00:00')
  now += 10000; tick()
  assert.equal(node.textContent, '00:00:00')
  assert.equal(game.status, 'started')
})

test('настоящая схема Mongoose сохраняет дату, очистку и прежний статус', async () => {
  const mongoose = (await import('mongoose')).default
  const schema = (await import('../schemas/gamesSchema.js')).default
  const Model = mongoose.model('ScheduleCountdownTest', new mongoose.Schema(schema))
  const doc = new Model({ dateEnd, status: 'started' })
  assert.equal(doc.toObject().dateEnd.toISOString(), dateEnd)
  doc.set({ dateEnd: null })
  assert.equal(doc.toObject().dateEnd, null)
  assert.equal(doc.status, 'started')
  assert.equal(new Model().dateEnd, null)
})

test('настоящий компонент отображает нужный отсчёт и скрывается после СТОП ИГРА', async () => {
  const filename = fileURLToPath(new URL('../components/location-game/GameScheduleCountdown.js', import.meta.url))
  const require = createRequire(filename)
  const swc = require('next/dist/build/swc')
  await swc.loadBindings()
  const { code } = await swc.transform(readFileSync(filename, 'utf8'), {
    filename, jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' },
  })
  const mod = { exports: {} }
  const localRequire = (id) => id === '@helpers/gameScheduleCountdown'
    ? { resolveGameScheduleCountdown, formatScheduleCountdown } : require(id)
  new Function('require', 'module', 'exports', code)(localRequire, mod, mod.exports)
  const render = (game) => renderToStaticMarkup(createElement(mod.exports.default, { game }))
  const serverTime = '2026-10-06T15:00:00Z'
  assert.match(render({ status: 'active', dateStart: '2026-10-06T15:10:00Z', serverTime }), /00:10:00/)
  assert.match(render({ status: 'started', dateEnd, serverTime }), /01:00:00/)
  assert.match(render({ status: 'started', dateEnd, serverTime: '2026-10-06T17:00:00Z' }), /00:00:00/)
  assert.equal(render({ status: 'started', dateEnd: null, serverTime }), '')
  assert.equal(render({ status: 'finished', dateEnd, serverTime }), '')
})
