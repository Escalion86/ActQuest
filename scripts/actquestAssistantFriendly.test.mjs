import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { renderToStaticMarkup } from 'react-dom/server'
import { handleAssistant, createLimiter } from '../server/assistant/gateway.mjs'
import { registrationAdvice } from '../server/assistant/registration.mjs'
import { FAQ_SOURCES } from '../server/assistant/knowledge.mjs'
import { toGameSources } from '../server/assistant/publicGames.mjs'
import * as questions from '../helpers/assistantQuestions.mjs'
import * as visibility from '../helpers/assistantVisibility.mjs'
const id = '123456789012345678901234'
const game = { _id: id, name: 'Гарри', dateStart: '2099-10-10T12:00:00Z', type: 'classic', participationMode: 'team', registrationOpen: true, location: 'krsk', status: 'active' }
const sources = toGameSources([game], 'krsk')
const nodes = tree => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(nodes) : [tree, ...nodes(tree.props?.children)]
async function panelFixture() {
  const require = createRequire(import.meta.url), swc = require('next/dist/build/swc'); await swc.loadBindings()
  const filename = fileURLToPath(new URL('../components/public/ActQuestAssistant.js', import.meta.url))
  const source = await readFile(filename, 'utf8')
  const { code } = await swc.transform(source + '\nexport { AssistantPanel }', { filename, jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' } })
  const states = [], refs = [], effects = [], queue = [], focus = []
  let slot = 0, refSlot = 0, effectSlot = 0
  const hooks = { ...require('react'), useState: initial => { const i = slot++; if (!(i in states)) states[i] = initial; return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value }] }, useRef: () => refs[refSlot++] ||= { current: null }, useEffect: (fn, deps) => { const i = effectSlot++, prev = effects[i]; if (!prev || deps.some((dep, j) => dep !== prev.deps[j])) queue.push(() => { prev?.cleanup?.(); effects[i] = { deps, cleanup: fn() } }) } }
  const module = { exports: {} }
  new Function('require', 'module', 'exports', code)(name => name === 'react' ? hooks : name === 'next/navigation' ? {} : name === 'next-auth/react' ? {} : name.includes('assistantVisibility') ? visibility : name.includes('assistantQuestions') ? questions : require(name), module, module.exports)
  return { dispose: () => { for (const effect of effects) effect?.cleanup?.() }, focus, render: city => { slot = refSlot = effectSlot = 0; const tree = module.exports.AssistantPanel({ initialCity: city, pathname: '/cabinet' }); for (const n of nodes(tree)) if (n.props?.ref) { const element = { tagName: String(n.type).toUpperCase(), focus: () => { focus.push(n.type); if (globalThis.document) globalThis.document.activeElement = element }, querySelector: () => ({ focus: () => focus.push('button') }), scrollTo: () => {} }; n.props.ref.current = element } return tree }, effects: () => { while (queue.length) queue.shift()() }, open: () => { states[0] = true }, busy: value => { states[5] = value } }
}
const button = (tree, text) => nodes(tree).find(n => n.type === 'button' && n.props.children === text)
test('фокус: открытие, выбор города, FAQ и ответ не фокусируют поле', async () => {
  for (const initialCity of [null, 'krsk']) {
    const f = await panelFixture(); f.open(); let tree = f.render(initialCity)
    // Первый эффект — только позиционирование звука, отдельные прежние тесты сохраняют этот контракт.
    const originalObserver = globalThis.ResizeObserver, originalDocument = globalThis.document, originalWindow = globalThis.window
    globalThis.ResizeObserver = class { observe() {} disconnect() {} }
    const body = { tagName: 'BODY' }
    globalThis.document = { body, activeElement: body, documentElement: { style: { getPropertyValue: () => '', setProperty: () => {}, removeProperty: () => {} } } }
    globalThis.window = { innerWidth: 390, innerHeight: 844, addEventListener() {}, removeEventListener() {} }
    // Не вызываем позиционирование: ref launcher должен поддерживать реальную геометрию.
    const launcher = nodes(tree).find(n => n.props?.['aria-expanded'] !== undefined)
    launcher.props.ref.current.getBoundingClientRect = () => ({ left: 200, bottom: 820, height: 44 })
    try {
      f.effects(); assert.deepEqual(f.focus, ['section'])
      assert.equal(nodes(tree).find(n => n.props?.role === 'dialog').props.tabIndex, -1)
      if (!initialCity) { button(tree, 'Красноярск').props.onClick(); globalThis.document.activeElement = body; tree = f.render(initialCity); f.effects(); assert.equal(globalThis.document.activeElement.tagName, 'SECTION') }
      globalThis.document.activeElement = body; f.busy(true); tree = f.render(initialCity); f.effects()
      assert.equal(globalThis.document.activeElement.tagName, 'SECTION')
      const manualInput = { tagName: 'TEXTAREA' }
      globalThis.document.activeElement = manualInput; f.busy(false); tree = f.render(initialCity); f.effects()
      assert.equal(globalThis.document.activeElement, manualInput)
      const originalFetch = globalThis.fetch
      globalThis.fetch = async () => ({ ok: true, json: async () => ({ success: true, mode: 'faq', answer: 'Короткий ответ' }) })
      try { await button(tree, 'Что такое автоквест?').props.onClick(); tree = f.render(initialCity); f.effects(); assert.ok(!f.focus.includes('textarea')); assert.ok(!f.focus.includes('input')) } finally { globalThis.fetch = originalFetch }
    } finally { f.dispose(); globalThis.ResizeObserver = originalObserver; globalThis.document = originalDocument; globalThis.window = originalWindow }
  }
})
test('карточка показывает название и спрашивает подробности; запись сохраняет выбранную игру', async () => {
  const f = await panelFixture(); f.open(); let tree = f.render('krsk')
  const original = globalThis.fetch, payloads = []
  globalThis.fetch = async (_url, options) => { payloads.push(JSON.parse(options.body)); return { ok: true, json: async () => ({ success: true, mode: 'faq', answer: 'Выберите игру', games: [{ gameId: id, title: 'Гарри' }] }) } }
  try {
    await button(tree, 'Какие ближайшие игры?').props.onClick(); tree = f.render('krsk')
    const markup = renderToStaticMarkup(tree)
    assert.match(markup, /Нажмите на игру, чтобы узнать подробности/); assert.doesNotMatch(markup, /Выбрать:|без ИИ|Нет подходящих данных/); assert.match(markup, />Помощник</)
    const card = button(tree, 'Гарри'); assert.ok(card); card.props.onClick(); await new Promise(resolve => setImmediate(resolve))
    assert.equal(payloads.at(-1).question, 'Подробнее об игре'); assert.equal(payloads.at(-1).gameId, id)
    tree = f.render('krsk'); await button(tree, 'Как записаться?').props.onClick()
    assert.equal(payloads.at(-1).gameId, id); assert.equal(payloads.at(-1).question, 'Как записаться?')
  } finally { globalThis.fetch = original }
})
test('тексты: приветствие и ответы без технических пояснений', async () => {
  const f = await panelFixture(); f.open()
  const markup = renderToStaticMarkup(f.render('krsk'))
  assert.match(markup, /Помогу выбрать игру и разобраться с участием\./)
  assert.doesNotMatch(markup, /Доступность ИИ|без ИИ|Нет подходящих данных/)
  const context = { available: true, game, teamsCount: 0, teams: [{ captain: true, location: 'krsk' }] }
  const captainAnswer = registrationAdvice(context, {}).answer
  assert.match(captainAnswer, /«Присоединиться»/)
  assert.match(registrationAdvice({ ...context, game: { ...game, participationMode: 'player' } }, {}).answer, /«Записаться»/)
  for (const data of [context, { ...context, teams: [] }, { ...context, game: { ...game, participationMode: 'player' } }]) assert.doesNotMatch(registrationAdvice(data, {}).answer, /сервер|техническ|Помощник ничего|окончательн/iu)
  for (const source of FAQ_SOURCES) assert.doesNotMatch(source.text, /Помощник не|опубликован|источник/iu)
  const tariff = toGameSources([{ ...game, prices: [{ price: 1000 }, { price: 2000 }], paymentMode: 'team' }], 'krsk')[0].text
  assert.match(tariff, /Стоимость и тарифы — в описании игры/); assert.doesNotMatch(tariff, /1000|2000|время города|Опубликованные/)
})
test('ошибка ответа понятна пользователю и не раскрывает разбор JSON', async () => {
  const f = await panelFixture(); f.open(); const tree = f.render('krsk'), original = globalThis.fetch
  globalThis.fetch = async () => ({ json: async () => { throw new SyntaxError('Unexpected API body token') } })
  try { await button(tree, 'Что такое автоквест?').props.onClick(); const markup = renderToStaticMarkup(f.render('krsk')); assert.match(markup, /Не удалось получить ответ/); assert.doesNotMatch(markup, /API|body|Unexpected|token/) } finally { globalThis.fetch = original }
})
test('подробности и следующий вопрос о записи используют ту же игру и серверную сессию', async () => {
  const session = { user: { id: '111111111111111111111111', role: 'client' } }
  let reads = 0
  const result = await ask({ question: 'Как записаться?' }, { getSession: async () => session, readRegistration: async args => { reads++; assert.equal(args.gameId, id); assert.equal(args.city, 'krsk'); assert.equal(args.session, session); return { available: true, game, teams: [{ captain: true, location: 'krsk' }], teamsCount: 0 } } })
  assert.equal(reads, 1); assert.equal(result.mode, 'personalised'); assert.match(result.answer, /выберите команду/i)
})
async function ask(extra = {}, options = {}) {
  const request = new Request('http://localhost/api/assistant', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ city: 'krsk', question: 'Подробнее об игре', gameId: id, pathname: '/cabinet', ...extra }) })
  return (await handleAssistant(request, { readAiSettings: async () => ({ assistantAiEnabled: false }), limiter: createLimiter({ dailyCalls: 0 }), apiKey: '', readGames: async () => ({ available: true, games: sources }), getSession: () => { throw new Error('Не читать сессию для подробностей') }, generate: () => { throw new Error('Не вызывать ИИ') }, ...options })).json()
}
test('подробности без ключа: точная публичная игра, без персонального чтения и оплаты по догадке', async () => {
  let city
  const result = await ask({}, { readGames: async value => { city = value; return { available: true, games: sources } } })
  assert.equal(city, 'krsk'); assert.equal(result.mode, 'faq'); assert.equal(result.answer, sources[0].text)
  assert.deepEqual(result.links, [{ title: 'Открыть игру', href: `/game/${id}` }]); assert.deepEqual(result.games, [])
})
for (const available of [true, false]) test(`подробности неизвестной игры: no-data available=${available}`, async () => {
  const result = await ask({ gameId: 'aaaaaaaaaaaaaaaaaaaaaaaa' }, { readGames: async () => ({ available, games: sources }) })
  assert.equal(result.mode, 'no-data'); assert.doesNotMatch(result.answer, /Гарри/); assert.ok(result.links.every(l => l.href !== '/game/aaaaaaaaaaaaaaaaaaaaaaaa'))
})
test('подробности без gameId предлагают карточки, не ИИ', async () => {
  const result = await ask({ gameId: undefined }); assert.equal(result.mode, 'faq'); assert.match(result.answer, /Выберите игру/); assert.equal(result.games[0].gameId, id)
})
