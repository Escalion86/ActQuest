import './actquestAssistantAiSettings.test.mjs'
import './actquestAssistantCity.test.mjs'
import './actquestAssistantFriendly.test.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { handleAssistant, createLimiter } from '../server/assistant/gateway.mjs'
import { isAssistantVisible } from '../helpers/assistantVisibility.mjs'
const id = '123456789012345678901234'
const session = { user: { globalUserId: '111111111111111111111111', location: 'krsk', role: 'client', name: 'НЕ ПЕРЕДАВАТЬ' } }
const game = { _id: id, location: 'krsk', participationMode: 'team', status: 'active', registrationOpen: true }
const context = { available: true, game, teams: [], registered: false, teamsCount: 0 }
const request = (extra = {}) => new Request('http://localhost/api/assistant', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ city: 'krsk', question: 'Хочу записаться', pathname: '/cabinet/games-upcoming', gameId: id, ...extra }) })
async function ask(extra = {}, opts = {}) {
  return handleAssistant(request(extra), { readAiSettings: async () => ({ assistantAiEnabled: false }), apiKey: '', limiter: createLimiter(), getSession: async () => session, readRegistration: async () => context, readGames: async () => ({ available: true, games: [{ id: 'game-1', title: 'Игра', href: `/game/${id}`, text: 'Будущая игра' }] }), generate: () => { throw new Error('ИИ не должен вызываться') }, ...opts })
}
for (const path of ['/cabinet', '/cabinet/teams', '/cabinet/profile', '/', '/krsk', '/nrsk', '/ekb']) test(`открыт без флага ${path}`, () => assert.equal(isAssistantVisible(path), true))
for (const path of ['/game/x/process/y', '/game/x/test/y', '/krsk/game/x', '/cabinet/admin/game-control', '/cabinet/admin/game-map/x', '/cabinet/agent/game-control', '/cabinet/admin/photo-review', '/cabinet/admin/task-preview', '/cabinet/game/x/process', '/cabinetish', '/game/x']) test(`скрыт игровой экран ${path}`, () => assert.equal(isAssistantVisible(path, new URLSearchParams('testai=true')), false))
for (const field of ['userId', 'role', 'teamRoles', 'user', 'session']) test(`поддельное поле ${field} запрещено`, async () => assert.equal((await ask({ [field]: 'captain' })).status, 400))
for (const [name, data, pattern] of [
  ['нет команд', context, /создайте|создать/i],
  ['personal не обычная команда', { ...context, teams: [{ kind: 'personal', captain: true, location: 'krsk' }] }, /создайте|создать/i],
  ['только участник', { ...context, teams: [{ kind: 'regular', captain: false, location: 'krsk' }] }, /капитан/i],
  ['капитан другого города', { ...context, teams: [{ captain: true, location: 'nrsk' }] }, /город/i],
  ['несколько команд', { ...context, teams: [{ captain: true, location: 'krsk' }, { captain: true, location: 'krsk' }] }, /2.*команд|команд.*2/i],
  ['уже зарегистрирован', { ...context, registered: true }, /уже.*зарегистр/i],
  ['player без команды', { ...context, game: { ...game, participationMode: 'player' } }, /индивидуальн/i],
  ['player уже зарегистрирован', { ...context, registered: true, game: { ...game, participationMode: 'player' } }, /уже.*зарегистр/i],
  ['full', { ...context, game: { ...game, maxTeams: 1 }, teamsCount: 1 }, /лимит/i],
  ['closed', { ...context, game: { ...game, registrationOpen: false } }, /закрыта/i],
]) test(`персональный совет: ${name}`, async () => { const r = await ask({}, { readRegistration: async () => data }); assert.equal(r.status, 200); const j = await r.json(); assert.equal(j.mode, 'personalised'); assert.match(j.answer, pattern); assert.doesNotMatch(JSON.stringify(j), /НЕ ПЕРЕДАВАТЬ|111111111111111111111111/); assert.ok(j.links.every(l => l.href.startsWith('/') && !l.href.startsWith('//'))) })
for (const getSession of [async () => null, async () => ({ user: null })]) test('нет сессии — только публичный FAQ без чтения членства', async () => { const j = await (await ask({}, { getSession, readRegistration: () => { throw new Error('не должно читаться') } })).json(); assert.equal(j.mode, 'faq'); assert.match(j.answer, /Войдите/i) })
test('главная даже с сессией не читает персональный контекст', async () => { const j = await (await ask({ pathname: '/' }, { readRegistration: () => { throw new Error('не должно читаться') } })).json(); assert.equal(j.mode, 'faq') })
test('без выбранной игры предлагает выбор и не утверждает наличие команды', async () => { const j = await (await ask({ gameId: undefined }, { readRegistration: () => { throw new Error('не должно читаться') } })).json(); assert.equal(j.mode, 'faq'); assert.match(j.answer, /выберите/i); assert.equal(j.games[0].gameId, id); assert.doesNotMatch(j.answer, /у вас нет команд/i) })
for (const readRegistration of [async () => ({ available: false }), async () => { throw new Error('DB failure') }]) test('ошибка БД не означает отсутствие команд', async () => { const j = await (await ask({}, { readRegistration })).json(); assert.equal(j.mode, 'no-data'); assert.match(j.answer, /не удалось/i); assert.doesNotMatch(j.answer, /нет команд/i) })
test('приватная/непубличная выбранная игра не раскрывается', async () => { const j = await (await ask({}, { readRegistration: async () => ({ available: true, game: null }) })).json(); assert.equal(j.mode, 'no-data'); assert.doesNotMatch(j.answer, /создайте/i) })
test('FAQ без ключа и при нулевом бюджете', async () => { const j = await (await ask({ question: 'Что такое автоквест?', gameId: undefined }, { limiter: createLimiter({ dailyCalls: 0 }) })).json(); assert.equal(j.mode, 'faq'); assert.match(j.answer, /Автоквест/i) })
test('свободный запрос с персональными параметрами не передаёт сессию модели', async () => { let captured; const r = await ask({ question: 'Чем отличаются форматы игр?' }, { apiKey: 'test', readAiSettings: async () => ({ assistantAiEnabled: true }), generate: async p => { captured = p; return { choices: [{ message: { content: '{"sourceIds":["about"]}' } }] } } }); assert.equal(r.status, 200); assert.doesNotMatch(JSON.stringify(captured), /НЕ ПЕРЕДАВАТЬ|111111111111111111111111|captain|pathname|gameId/) })
test('один mount в provider и без обхода proxy', async () => { const provider = await readFile(new URL('../app/providers.js', import.meta.url), 'utf8'); assert.match(provider, /<ActQuestAssistant/); for (const p of ['../app/page.js', '../app/[location]/page.js']) assert.doesNotMatch(await readFile(new URL(p, import.meta.url), 'utf8'), /<ActQuestAssistant/); assert.doesNotMatch(await readFile(new URL('../proxy.js', import.meta.url), 'utf8'), /isAssistantVisible/) })
