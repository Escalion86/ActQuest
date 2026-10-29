import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { readRegistration } from '../server/assistant/registration.mjs'
import { handleAssistant, createLimiter } from '../server/assistant/gateway.mjs'
const id = '123456789012345678901234', uid = '111111111111111111111111', tid = '222222222222222222222222'
const session = { user: { globalUserId: uid, location: 'krsk', role: 'client' } }
const game = { _id: id, name: 'Публичная игра', location: 'krsk', dateStart: new Date('2027-01-01'), status: 'active', participationMode: 'team', registrationOpen: true, maxTeams: 2 }
function fixture({ personal = false, memberRole = 'captain', registered = false, missingGame = false, fail = false } = {}) {
  const calls = []; let closed = false
  const client = { db: () => ({ collection: name => ({
    async findOne(query, options) { calls.push({ name, method: 'findOne', query, options }); if (fail) throw new Error('DB'); if (name === 'users') return { _id: uid }; if (name === 'games') return missingGame ? null : game; if (name === 'gamesteams') return registered ? { _id: id } : null; throw new Error(name) },
    find(query, options) { calls.push({ name, method: 'find', query, options }); return { limit: limit => ({ toArray: async () => name === 'teamsusers' ? [{ teamId: tid, role: memberRole }] : [{ _id: tid, kind: personal ? 'personal' : 'regular', location: 'krsk', ownerUserId: uid }] }) } },
    async countDocuments(query, options) { calls.push({ name, method: 'count', query, options }); return 1 },
  }) }), async close() { closed = true } }
  return { calls, createClient: () => client, closed: () => closed }
}
for (const config of [{}, { memberRole: 'participant' }, { memberRole: 'CAPTAIN' }, { registered: true }, { personal: true }, { missingGame: true }, { fail: true }]) test(`реальный reader с контролируемым driver ${JSON.stringify(config)}`, async () => {
  const f = fixture(config)
  const data = await readRegistration({ session, city: 'krsk', gameId: id, createClient: f.createClient })
  assert.equal(data.available, !config.fail)
  assert.ok(f.closed())
  if (config.fail) return
  const q = f.calls.find(c => c.name === 'games').query
  assert.equal(String(q._id), id); assert.equal(q.location, 'krsk'); assert.equal(q.status, 'active'); assert.deepEqual(q.hidden, { $eq: false }); assert.deepEqual(q.isPrivate, { $ne: true }); assert.deepEqual(q.orderType, { $in: ['public', null] }); assert.equal(q.sourceOrderId, null)
  for (const c of f.calls) { assert.equal(c.options.maxTimeMS, 1500); if (c.options.projection) for (const key of ['name', 'phone', 'email', 'tasks', 'codes', 'clues']) { if (c.name !== 'games' || key !== 'name') assert.ok(!Object.hasOwn(c.options.projection, key)) } }
  if (config.missingGame) { assert.equal(data.game, null); assert.ok(!f.calls.some(c => c.name === 'teamsusers')); return }
  assert.deepEqual(f.calls.find(c => c.name === 'teamsusers').query, { userId: uid })
  assert.equal(data.teams[0].captain, (config.memberRole || 'captain') === 'captain')
  assert.equal(data.registered, Boolean(config.registered) && !config.personal)
  assert.equal(data.teamsCount, 1)
})
test('reader нельзя запустить без server identity или с неверным gameId', async () => { const createClient = () => { throw new Error('не должен вызываться') }; assert.equal((await readRegistration({ session: null, city: 'krsk', gameId: id, createClient })).available, false); assert.equal((await readRegistration({ session, city: 'krsk', gameId: 'malformed', createClient })).available, false) })
test('реальный route получает сессию только через getServerSession', async () => {
  const require = createRequire(import.meta.url), swc = require('next/dist/build/swc'); await swc.loadBindings()
  const filename = fileURLToPath(new URL('../app/api/assistant/route.js', import.meta.url))
  const { code } = await swc.transform(await readFile(filename, 'utf8'), { filename, jsc: { parser: { syntax: 'ecmascript' } }, module: { type: 'commonjs' } })
  let auth = null, reads = 0, sessions = 0
  const module = { exports: {} }
  new Function('require', 'module', 'exports', code)(name => name === 'next-auth' ? { getServerSession: async options => { assert.deepEqual(options, { test: true }); sessions++; return auth } } : name.includes('authOptions') ? { authOptions: { test: true } } : name.includes('gateway') ? { handleAssistant: (request, options) => handleAssistant(request, { ...options, apiKey: '', limiter: createLimiter(), readRegistration: async ({ session: s }) => { assert.equal(s, auth); reads++; return { available: true, game, teams: [], registered: false } }, readGames: async () => ({ available: true, games: [] }) }) } : require(name), module, module.exports)
  const req = extra => new Request('http://localhost/api/assistant', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ city: 'krsk', question: 'Хочу записаться', pathname: '/cabinet', gameId: id, ...extra }) })
  assert.equal((await (await module.exports.POST(req())).json()).mode, 'faq'); assert.equal(reads, 0)
  auth = session
  assert.equal((await (await module.exports.POST(req())).json()).mode, 'personalised'); assert.equal(reads, 1)
  assert.equal((await module.exports.POST(req({ userId: uid, teamRoles: ['captain'] }))).status, 400); assert.equal(reads, 1)
  assert.equal(sessions, 2)
})
