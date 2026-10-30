// Настоящие handler и JSX; сессия, метаданные файлов, TipTap и upstream — моки.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import path from 'node:path'
const require = createRequire(import.meta.url)
const swc = require('next/dist/build/swc')
await swc.loadBindings()
const MB = 1024 * 1024
function loader(mocks = {}) {
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
const video = (size, extra = {}) => ({ name: 'probe.mp4', type: 'video/mp4', size, slice: () => new Blob([Buffer.from('000000186674797069736f6d00000000','hex')]), ...extra })
async function call({ role = 'admin', files = [video(100 * MB)], length, directory = 'actquest/tasks' } = {}) {
  let forwarded = 0
  const load = loader({ 'next/server': { NextResponse: Response }, 'next-auth': { getServerSession: async () => role ? { user: { id: 'test', role } } : null }, '@server/auth/authOptions': { authOptions: {} }, '@utils/dbConnectGlobal': { default: async () => { throw Error('Unexpected DB') }, __esModule: true }, '@helpers/resolveTeamMembershipForIdentity': { default: () => ({}), __esModule: true }, '@helpers/teamBanAccess': { canCreateTeamForRole: r => r === 'client' } })
  const oldFetch = globalThis.fetch, oldForm = globalThis.FormData, oldPassword = process.env.ESCALIONCLOUD_PASSWORD
  process.env.ESCALIONCLOUD_PASSWORD = 'test-only'
  globalThis.FormData = class { append() {} }
  globalThis.fetch = async () => { forwarded++; return Response.json({ status: 'ok', urls: ['https://cloud.escalion.ru/uploads/probe.mp4'] }) }
  try {
    const result = await load('@app/api/escalioncloud/route').POST({ headers: new Headers(length == null ? {} : { 'content-length': String(length) }), formData: async () => ({ getAll: () => files, get: name => name === 'directory' ? directory : null }) })
    return { status: result.status, forwarded, body: await result.json() }
  } finally { globalThis.fetch = oldFetch; globalThis.FormData = oldForm; if (oldPassword == null) delete process.env.ESCALIONCLOUD_PASSWORD; else process.env.ESCALIONCLOUD_PASSWORD = oldPassword }
}
for (const role of ['moder','admin','dev']) test(`${role}: видео 100 МБ включительно`, async () => { const r = await call({role}); assert.equal(r.status,200); assert.equal(r.forwarded,1) })
test('100 МБ + 1 запрещён', async () => { const r = await call({files:[video(100*MB+1)]}); assert.equal(r.status,400); assert.equal(r.forwarded,0) })
for (const type of ['image/jpeg','audio/mpeg']) for (const delta of [0,1]) test(`${type}: прежняя граница 50 МБ + ${delta}`, async () => { const r=await call({files:[video(50*MB+delta,{type})]}); assert.equal(r.status,delta?400:200) })
for (const extra of [{name:'fake.jpg'}, {type:'image/jpeg'}, {slice:()=>new Blob(['not video'])}]) test('одного MIME недостаточно для повышенного лимита', async () => assert.equal((await call({files:[video(60*MB,extra)]})).status,400))
for (const delta of [0,1]) test(`участник: 25 МБ + ${delta}`, async () => assert.equal((await call({role:'client',directory:'actquest/teams/draft',files:[video(25*MB+delta,{type:'image/jpeg',name:'p.jpg'})]})).status,delta?400:200))
test('участник не получает видео и чужой каталог', async () => { assert.equal((await call({role:'client',directory:'actquest/teams/draft',files:[video(MB)]})).status,400); assert.equal((await call({role:'client'})).status,403); assert.equal((await call({role:'ban'})).status,403) })
test('нет сессии: 401 до разбора тела', async () => assert.equal((await call({role:null})).status,401))
test('ограничения суммарного размера и Content-Length', async () => { assert.equal((await call({files:[video(60*MB),video(40*MB)]})).status,200); assert.equal((await call({files:[video(60*MB),video(40*MB+1)]})).status,413); assert.equal((await call({files:[video(30*MB),video(30*MB)]})).status,413); assert.equal((await call({length:105*MB+1})).status,413); assert.equal((await call({role:'client',length:55*MB+1})).status,413) })
test('не больше пяти файлов', async () => { assert.equal((await call({files:Array.from({length:5},()=>video(MB))})).status,200); assert.equal((await call({files:Array.from({length:6},()=>video(MB))})).status,400) })
test('настоящий JSX/обработчик: граница видео и таймаут', async () => {
  const React = require('react'), callbacks = [], states = [], sent = []
  const universal = new Proxy(function(){ return universal }, { get: (_, k) => k === '__esModule' ? false : k === 'then' ? undefined : universal })
  const hooks = { ...React, memo: fn=>fn, useEffect(){}, useMemo: fn=>fn(), useCallback: fn=>{callbacks.push(fn); return fn}, useRef: value=>({current:value}), useState: value=>[typeof value==='function'?value():value, next=>states.push(next)] }
  const mocks = { react:hooks, '@tiptap/react':{ useEditor:()=>universal, EditorContent:()=>null, NodeViewWrapper:()=>null, ReactNodeViewRenderer:()=>null }, '@helpers/cloudinary':{sendImage:async(...args)=>{sent.push(args);return null}} }
  const source = readFileSync('components/cabinet/TaskRichEditor.js','utf8')
  for(const [,id] of source.matchAll(/from '([^']+)'/g)) if(!(id in mocks) && id !== 'prop-types') mocks[id] = universal
  const Editor=loader(mocks)('@components/cabinet/TaskRichEditor').default
  Editor({value:'',onChange(){},directory:'tasks'})
  const upload=callbacks.find(fn=>fn.toString().includes('MAX_VIDEO_SIZE_BYTES'))
  assert.ok(upload)
  await upload(video(100*MB),'video'); assert.equal(sent.length,1); assert.equal(sent[0][6],300000)
  await upload(video(100*MB+1),'video'); assert.equal(sent.length,1); assert.ok(states.some(s=>typeof s==='string'&&s.includes('100 МБ')))
})
