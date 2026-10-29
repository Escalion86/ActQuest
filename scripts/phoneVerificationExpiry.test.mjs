import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, request, providerRun, input } from './phoneVerification.fixture.mjs'

const providerPhone = { success: true, data: { phone: '89001234567' } }
const callRequest = () => request({ ...input, callId: 123 })
for (const [label, confirmed, callLeft, totalLeft, expected] of [
  ['просроченный неподтверждённый звонок', false, -1000, 60000, 'expired'],
  ['истёкший общий TTL при живом звонке', false, 60000, -1000, 'expired'],
  ['истёкший общий TTL подтверждённой записи', true, -1000, -1000, 'expired'],
  ['подтверждённый звонок сохраняется до общего TTL', true, -1000, 60000, 'ok'],
  ['живой звонок подтверждается по provider phone', false, 60000, 60000, 'ok'],
]) test(`call TTL: ${label}`, async () => {
  const f = fixture()
  f.doc = { _id: 'v', callId: 123, verificationMethod: 'call', confirmed, callExpiresAt: new Date(Date.now() + callLeft), expiresAt: new Date(Date.now() + totalLeft) }
  await providerRun(f, async () => {
    const response = await f.load('@app/api/phone/verify/check/route').POST(callRequest())
    assert.equal(response.status, 200)
    assert.equal((await response.json()).data.status, expected)
    assert.equal(f.doc.confirmed, confirmed || expected === 'ok')
    assert.equal(f.sends.length, !confirmed && expected === 'ok' ? 1 : 0)
  }, providerPhone)
})
for (const field of ['callExpiresAt', 'expiresAt']) test(`call TTL: ${field} истекает во время ответа провайдера`, async () => {
  const f = fixture(), originalFetch = globalThis.fetch, originalNow = Date.now
  const now = originalNow()
  f.doc = { _id: 'v', callId: 123, verificationMethod: 'call', confirmed: false, callExpiresAt: new Date(now + 60000), expiresAt: new Date(now + 60000), [field]: new Date(now + 1000) }
  globalThis.fetch = async () => { Date.now = () => now + 2000; return Response.json(providerPhone) }
  try {
    const response = await f.load('@app/api/phone/verify/check/route').POST(callRequest())
    assert.equal(response.status, 200); assert.equal((await response.json()).data.status, 'expired'); assert.equal(f.doc.confirmed, false)
  } finally { globalThis.fetch = originalFetch; Date.now = originalNow }
})
