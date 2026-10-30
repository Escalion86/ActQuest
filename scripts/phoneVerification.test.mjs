import test from 'node:test'
import assert from 'node:assert/strict'
import { loader, fixture, request, providerRun, input } from './phoneVerification.fixture.mjs'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
test('нормализатор: default/invalid → call, sms → sms', () => {
  const normalize = loader()('@helpers/normalizeSiteSettings').default
  for (const value of [undefined, null, '', 'SMS', {}, true, 'call']) assert.equal(normalize({ phoneVerificationPrimaryMethod: value }).phoneVerificationPrimaryMethod, 'call')
  assert.equal(normalize({ phoneVerificationPrimaryMethod: 'sms' }).phoneVerificationPrimaryMethod, 'sms')
})
for (const role of [null, 'client', 'admin', 'dev']) test(`приоритет PATCH: ${role}`, async () => {
  const f = fixture(); f.role(role)
  const res = await f.load('@app/api/cabinet/settings/route').PATCH(request({ phoneVerificationPrimaryMethod: 'call' }, 'PATCH'))
  assert.equal(res.status, role === 'dev' ? 200 : role ? 403 : 401)
  if (role === 'dev') { assert.equal(f.settings.phoneVerificationPrimaryMethod, 'call'); assert.equal(f.settings.assistantAiEnabled, true); assert.equal(f.settings.supportPhone, 'keep'); assert.deepEqual(f.updates, [{ $set: { phoneVerificationPrimaryMethod: 'call' } }]) }
})
for (const method of ['preferred', undefined]) test(`start ${method}: настоящий адаптер, mock fetch`, async () => {
  const f = fixture()
  await providerRun(f, async () => {
    const res = await f.load('@app/api/phone/verify/start/route').POST(request({ ...input, method })); assert.equal(res.status, 200)
    const body = await res.json(); assert.equal(body.data.method, method ? 'sms' : 'call')
    assert.match(f.sends[0], method ? /get_sms_code\/89001234567\// : /reverse_auth_phone_get/)
    assert.equal(f.sends.length, 1)
    assert.doesNotMatch(JSON.stringify(body), /"(?:code|smsCode|smsCodeHash|smsCodeSalt)"\s*:/); assert.equal(Object.values(f.doc).includes('4826'), false); assert.equal(f.doc.meta, null)
  })
})
for (const role of [null, 'client', 'admin', 'dev']) for (const wrapped of [false, true]) test(`PUT приоритет запрещён ${role}, data=${wrapped}`, async () => {
  const f = fixture(); f.role(role)
  const body = { phoneVerificationPrimaryMethod: 'sms' }
  const res = await f.load('@app/api/cabinet/settings/route').PUT(request(wrapped ? { data: body } : body, 'PUT'))
  assert.equal(res.status, !role ? 401 : role === 'dev' ? 400 : 403); assert.equal(f.updates.length, 0)
})
for (const body of [{}, { phoneVerificationPrimaryMethod: 'SMS' }, { phoneVerificationPrimaryMethod: null }, { phoneVerificationPrimaryMethod: 'sms', assistantAiEnabled: false }, { supportPhone: 'x' }, { data: { phoneVerificationPrimaryMethod: 'sms' } }]) test(`PATCH строгий payload ${JSON.stringify(body)}`, async () => {
  const f = fixture(); f.role('dev'); const res = await f.load('@app/api/cabinet/settings/route').PATCH(request(body, 'PATCH')); assert.equal(res.status, 400); assert.equal(f.updates.length, 0)
})
test('настройки независимы: PATCH ИИ, PATCH телефона, общий PUT, GET', async () => {
  const f = fixture(); f.role('dev'); const route = f.load('@app/api/cabinet/settings/route')
  assert.deepEqual(await (await route.PATCH(request({ assistantAiEnabled: false }, 'PATCH'))).json(), { success: true, data: { assistantAiEnabled: false } })
  assert.equal(f.settings.phoneVerificationPrimaryMethod, 'sms')
  assert.equal((await route.PATCH(request({ phoneVerificationPrimaryMethod: 'call' }, 'PATCH'))).status, 200)
  assert.equal((await route.PUT(request({ supportPhone: 'new', allowSmsVerification: false }, 'PUT'))).status, 200)
  const body = await (await route.GET()).json()
  assert.equal(body.data.phoneVerificationPrimaryMethod, 'call'); assert.equal(body.data.assistantAiEnabled, false); assert.equal(body.data.supportPhone, 'new')
})
for (const [primary, allowed, method, expected] of [['call', true, 'preferred', 'call'], ['sms', false, 'preferred', 'sms'], ['call', false, 'preferred', 'call'], ['invalid', true, 'preferred', 'call'], ['sms', true, 'call', 'call']]) test(`выбор ${primary}/${allowed}/${method}`, async () => {
  const f = fixture(); Object.assign(f.settings, { phoneVerificationPrimaryMethod: primary, allowSmsVerification: allowed })
  await providerRun(f, async () => { const r = await f.load('@app/api/phone/verify/start/route').POST(request({ ...input, method })); assert.equal(r.status, 200); assert.equal((await r.json()).data.method, expected) })
})
for (const endpoint of ['start', 'sms/start']) {
  const run = async (f, body, status) => providerRun(f, async () => { const r = await f.load(`@app/api/phone/verify/${endpoint}/route`).POST(request(body)); assert.equal(r.status, status, JSON.stringify(await r.json())); if (status !== 200) assert.equal(f.sends.length, 0) })
  for (const [label, body, setup, status] of [
    ['номер', { ...input, phone: '123' }, () => {}, 400],
    ['flow', { ...input, flow: 'login' }, () => {}, 400],
    ['нет города', { ...input, location: null }, () => {}, 400],
    ['неверный город', { ...input, location: 'unknown' }, () => {}, 400],
    ['регистрация запрещена', input, f => { f.settings.allowSiteRegistration = false }, 403],
    ['номер с паролем', input, f => f.users.push({ phone: 79001234567, passwordHash: 'hash' }), 400],
    ['восстановление отсутствующего', { ...input, flow: 'recovery' }, () => {}, 404],
    ['смена без сессии', { ...input, flow: 'change_phone' }, () => {}, 401],
    ['смена на свой', { ...input, flow: 'change_phone' }, f => { f.role('client'); f.users.push({ _id: 'me', phone: 79001234567 }) }, 400],
    ['смена на чужой', { ...input, flow: 'change_phone' }, f => { f.role('client'); f.users.push({ _id: 'me', phone: 79000000000 }, { _id: 'other', phone: 79001234567 }) }, 400],
    ['смена без пользователя', { ...input, flow: 'change_phone' }, f => f.role('client'), 404],
    ['регистрация VK без пароля', input, f => f.users.push({ phone: 79001234567 }), 200],
    ['восстановление', { ...input, flow: 'recovery' }, f => f.users.push({ phone: 79001234567 }), 200],
    ['смена', { ...input, flow: 'change_phone' }, f => { f.role('client'); f.users.push({ _id: 'me', phone: 79000000000 }) }, 200],
  ]) test(`${endpoint}: ${label}`, async () => { const f = fixture(); setup(f); await run(f, body, status) })
}
test('sms/start: SMS доступен при любом приоритете и при снятом старом флаге', async () => {
  for (const [primary, allowed, status] of [['sms', true, 200], ['call', true, 200], ['sms', false, 200], ['call', false, 200]]) {
    const f = fixture(); Object.assign(f.settings, { phoneVerificationPrimaryMethod: primary, allowSmsVerification: allowed })
    await providerRun(f, async () => assert.equal((await f.load('@app/api/phone/verify/sms/start/route').POST(request(input))).status, status))
  }
})
test('cooldown общий: SMS → звонок, звонок → SMS, ошибки провайдера, concurrent start', async () => {
  for (const first of ['preferred', 'call']) {
    const f = fixture()
    await providerRun(f, async () => {
      const route = f.load('@app/api/phone/verify/start/route')
      assert.equal((await route.POST(request({ ...input, method: first }))).status, 200)
      assert.equal((await route.POST(request({ ...input, method: first === 'call' ? 'preferred' : 'call' }))).status, 429)
      assert.equal((await f.load('@app/api/phone/verify/sms/start/route').POST(request(input))).status, 429)
      assert.equal(f.sends.length, 1)
      f.doc.startRequestedAt = f.doc.smsSentAt = f.doc.updatedAt = new Date(Date.now() - 61000)
      assert.equal((await f.load('@app/api/phone/verify/sms/start/route').POST(request(input))).status, 200)
    })
  }
  const f = fixture()
  await providerRun(f, async () => {
    const route = f.load('@app/api/phone/verify/start/route')
    const responses = await Promise.all([route.POST(request(input)), route.POST(request(input))])
    assert.deepEqual(responses.map(r => r.status).sort(), [200, 429]); assert.equal(f.sends.length, 1)
  })
})
for (const data of [{ success: false, error: 'quantity limit per day' }, { success: true, data: { code: 'BAD' } }, { success: true, data: { code: '4826', status: false } }]) test(`SMS provider error: ${JSON.stringify(data)}`, async () => {
  const f = fixture()
  await providerRun(f, async () => {
    const route = f.load('@app/api/phone/verify/start/route')
    const res = await route.POST(request(input)); assert.equal(res.status, data.error ? 429 : 502)
    assert.equal((await route.POST(request({ ...input, method: 'call' }))).status, 429)
    assert.equal(f.sends.length, 1); assert.ok(!f.doc.smsCodeHash)
  }, data)
})
test('ошибка fetch с секретом не попадает в ответ/логи; нет автоматического fallback', async () => {
  const f = fixture(), original = globalThis.fetch, log = console.error, logs = []
  console.error = (...args) => logs.push(args)
  globalThis.fetch = async () => { f.sends.push('mock'); throw new Error('https://secret-token/code-4826') }
  try { const r = await f.load('@app/api/phone/verify/start/route').POST(request(input)); assert.equal(r.status, 500); assert.doesNotMatch(JSON.stringify(await r.json()), /secret-token|4826/); assert.deepEqual(logs, []); assert.equal(f.sends.length, 1) }
  finally { globalThis.fetch = original; console.error = log }
})
test('SMS hash/salt: неверный/просроченный код, 5 попыток, правильный код и очистка', async () => {
  const f = fixture()
  await providerRun(f, async () => {
    assert.equal((await f.load('@app/api/phone/verify/start/route').POST(request(input))).status, 200)
    const route = f.load('@app/api/phone/verify/sms/check/route')
    const check = code => route.POST(request({ ...input, code }))
    assert.equal((await check('x')).status, 400)
    f.doc.expiresAt = new Date(Date.now() - 1000); assert.equal((await check('4826')).status, 400)
    f.doc.expiresAt = new Date(Date.now() + 60000)
    for (let i = 0; i < 5; i++) assert.equal((await check('0000')).status, 400)
    assert.equal((await check('4826')).status, 429)
    f.doc.smsAttempts = 0
    assert.equal((await check('4826')).status, 200); assert.equal(f.doc.confirmed, true); assert.equal(f.doc.smsCodeHash, undefined); assert.equal(f.doc.smsCodeSalt, undefined)
  })
})
test('Mongoose: первичный SMS валиден без callId, startRequestedAt сохраняется', () => {
  const mongoose = require('mongoose')
  const schema = new mongoose.Schema(loader()('@schemas/phoneVerificationsSchema').default)
  const Model = mongoose.model('PhonePriorityTest', schema)
  assert.equal(new Model({ phone: 79001234567, flow: 'register', verificationMethod: 'sms', expiresAt: new Date(), startRequestedAt: new Date() }).validateSync(), undefined)
})

test('polling звонка не продлевает cooldown отправки; fallback доступен через минуту', async () => {
  const f = fixture()
  f.doc = { _id: 'legacy', startRequestedAt: new Date(Date.now() - 61000), updatedAt: new Date(), verificationMethod: 'call' }
  await providerRun(f, async () => assert.equal((await f.load('@app/api/phone/verify/sms/start/route').POST(request(input))).status, 200))
})
for (const expired of [false, true]) test(`реальный change-phone finalize SMS без callId, expired=${expired}`, async () => {
  const f = fixture(); f.role('client'); f.users.push({ _id: 'me', phone: 79000000000 })
  f.doc = { _id: 'verification', verificationMethod: 'sms', confirmed: true, expiresAt: new Date(Date.now() + (expired ? -60000 : 60000)) }
  const response = await f.load('@app/api/cabinet/users/change-phone/route').POST(request({ phone: 79001234567, callId: null }))
  assert.equal(response.status, expired ? 400 : 200); assert.equal(f.users[0].phone, expired ? 79000000000 : 79001234567)
})
test('старое call/check не подтверждает SMS-запись', async () => {
  const f = fixture(); f.doc = { _id: 'v', callId: 123, verificationMethod: 'sms', confirmed: false }
  await providerRun(f, async () => { assert.equal((await f.load('@app/api/phone/verify/check/route').POST(request({ ...input, callId: 123 }))).status, 404); assert.equal(f.sends.length, 0) })
})

test('запоздалый провайдер не возвращает успех после потери CAS', async () => {
  const f = fixture(), original = globalThis.fetch
  globalThis.fetch = async () => { f.doc.startRequestedAt = new Date(Date.now() + 61000); return Response.json({ success: true, data: { code: '4826' } }) }
  try { assert.equal((await f.load('@app/api/phone/verify/start/route').POST(request(input))).status, 429); assert.equal(f.doc.smsCodeHash, undefined) }
  finally { globalThis.fetch = original }
})
test('ошибка повторного старта не продлевает TTL старой верификации', async () => {
  const f = fixture(); const expiresAt = new Date(Date.now() + 2000)
  f.doc = { _id: 'old', startRequestedAt: new Date(Date.now() - 61000), expiresAt }
  await providerRun(f, async () => { assert.equal((await f.load('@app/api/phone/verify/start/route').POST(request(input))).status, 502); assert.equal(+f.doc.expiresAt, +expiresAt) }, { success: false })
})

test('call/check CAS: смена на SMS во время провайдера не перезаписывает состояние', async () => {
  const f = fixture(), original = globalThis.fetch
  f.doc = { _id: 'v', callId: 123, verificationMethod: 'call', confirmed: false }
  globalThis.fetch = async () => { f.doc.verificationMethod = 'sms'; return Response.json({ success: true, data: { phone: '89001234567' } }) }
  try { const r = await f.load('@app/api/phone/verify/check/route').POST(request({ ...input, callId: 123 })); assert.equal(r.status, 409); assert.equal(f.doc.confirmed, false) }
  finally { globalThis.fetch = original }
})
