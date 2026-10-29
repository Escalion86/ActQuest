import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import path from 'node:path'
const require = createRequire(import.meta.url)
const swc = require('next/dist/build/swc')
await swc.loadBindings()
const root = process.cwd()
export function loader(mocks = {}) {
  const cache = new Map()
  function load(file) {
    if (Object.hasOwn(mocks, file)) return mocks[file]
    if (!/^@(app|helpers|server|utils|schemas|components|state|lib)\//.test(file) && !file.startsWith('.') && !file.startsWith('/')) return require(file)
    const target = file.startsWith('@') ? path.join(root, file.slice(1)) : file
    const filename = path.extname(target) ? target : `${target}.js`
    if (cache.has(filename)) return cache.get(filename).exports
    const module = { exports: {} }; cache.set(filename, module)
    const { code } = swc.transformSync(readFileSync(filename, 'utf8'), { jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' } })
    new Function('require', 'module', 'exports', 'process', code)(id => load(id.startsWith('.') ? path.resolve(path.dirname(filename), id) : id), module, module.exports, { env: { TELEFONIP: 'test-only-token' } })
    return module.exports
  }
  return load
}
const query = value => ({ select() { return this }, sort() { return this }, lean: async () => structuredClone(value), then: fn => Promise.resolve(structuredClone(value)).then(fn) })
export function fixture() {
  let doc = null, settings = { _id: 'settings', phoneVerificationPrimaryMethod: 'sms', allowSmsVerification: true, allowSiteRegistration: true, assistantAiEnabled: true, supportPhone: 'keep' }, session = null
  const users = [], updates = [], sends = []
  const apply = (update, current) => {
    Object.assign(current, update.$set)
    for (const key of Object.keys(update.$unset || {})) delete current[key]
    for (const [key, val] of Object.entries(update.$inc || {})) current[key] = (current[key] || 0) + val
  }
  const matches = filter => {
    if (filter._id && String(filter._id) !== String(doc?._id)) return false
    if (filter.startRequestedAt && +new Date(filter.startRequestedAt) !== +new Date(doc?.startRequestedAt)) return false
    if (filter.callId && filter.callId !== doc?.callId) return false
    if (filter.verificationMethod?.$ne && filter.verificationMethod.$ne === doc?.verificationMethod) return false
    return !filter.$or || filter.$or.some(f => f.startRequestedAt === null ? doc?.startRequestedAt == null : f.startRequestedAt?.$exists === false ? doc?.startRequestedAt === undefined : +new Date(doc?.startRequestedAt) <= +new Date(f.startRequestedAt?.$lte))
  }
  const verifications = {
    findOne: () => query(doc),
    findOneAndUpdate(filter, update, opts = {}) {
      if (doc && !matches(filter)) {
        if (opts.upsert) return Promise.reject(Object.assign(new Error('duplicate'), { code: 11000 }))
        return query(null)
      }
      if (!doc) { doc = { _id: filter._id || 'verification', ...update.$setOnInsert } }
      apply(update, doc); updates.push(update); return query(doc)
    },
    deleteMany() { doc = null; return Promise.resolve({ deletedCount: 1 }) },
    updateOne(filter, update) { const matched = matches(filter); if (matched) apply(update, doc); updates.push(update); return Promise.resolve({ modifiedCount: matched ? 1 : 0 }) },
  }
  const model = {
    findOne: () => query(settings),
    findByIdAndUpdate: (_id, update) => { apply(update, settings); updates.push(update); return query(settings) },
    create: async payload => { settings = { _id: 'settings', ...payload }; return settings },
  }
  const load = loader({
    'next/server': { NextResponse: Response }, 'next-auth': { getServerSession: async () => session }, '@server/auth/authOptions': { authOptions: {} },
    '@utils/dbConnectGlobal': async () => ({ model: name => name === 'SiteSettings' ? model : name === 'Users' ? { findOne: filter => query(users.find(u => filter.phone ? u.phone === filter.phone : String(u._id) === String(filter._id))), findByIdAndUpdate: (id, update) => { const user = users.find(u => String(u._id) === String(id)); apply(update, user); return query(user) } } : verifications }),
    '@helpers/resolveSessionUserFilter': user => user.id ? { _id: user.id } : null,
  })
  return { load, settings, users, updates, sends, get doc() { return doc }, set doc(value) { doc = value }, role(role, id = 'me') { session = role ? { user: { role, id } } : null } }
}
export const request = (body, method = 'POST') => new Request('http://localhost', { method, body: JSON.stringify(body) })
const input = { phone: '+7 (900) 123-45-67', flow: 'register', location: 'krsk', method: 'preferred' }
async function providerRun(f, fn, response = { success: true, data: { code: '4826', id: 12, auth_phone: '88005553535' } }) {
  const original = globalThis.fetch
  globalThis.fetch = async url => { f.sends.push(url); return Response.json(response) }
  try { return await fn() } finally { globalThis.fetch = original }
}
export { providerRun, input }
