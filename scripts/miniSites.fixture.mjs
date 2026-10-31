// Явная фикстура серверной сессии; SWC загружает настоящие handlers без БД.
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { mkdtemp, chmod, mkdir } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import os from 'node:os'
const require = createRequire(import.meta.url)
const swc = require('next/dist/build/swc')
await swc.loadBindings()
export function loader(env, mocks = {}) {
  const cache = new Map()
  function load(id) {
    if (Object.hasOwn(mocks, id)) return mocks[id]
    if (!id.startsWith('@') && !path.isAbsolute(id) && !id.startsWith('.')) return require(id)
    let filename = id.startsWith('@') ? path.join(process.cwd(), id.slice(1)) : id
    if (!path.extname(filename)) filename += '.js'
    if (cache.has(filename)) return cache.get(filename).exports
    const module = { exports: {} }; cache.set(filename, module)
    const { code } = swc.transformSync(readFileSync(filename, 'utf8'), { jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' } })
    new Function('require', 'module', 'exports', 'process', code)(child => load(child.startsWith('.') ? path.resolve(path.dirname(filename), child) : child), module, module.exports, { env, cwd: () => process.cwd(), getuid: () => process.getuid(), pid: process.pid })
    return module.exports
  }
  return load
}
export const output = path.resolve(process.env.MINI_SITES_TEST_OUTPUT || path.join(os.tmpdir(), 'actquest-mini-sites-evidence'))
export const testTemp = path.resolve(process.env.MINI_SITES_TEST_TMP || os.tmpdir())
export async function fixture(overrides = {}, mocks = {}) {
  await mkdir(testTemp, { recursive: true })
  const root = await mkdtemp(path.join(testTemp, 'ms-'))
  await chmod(root, 0o2750)
  const env = { MINI_SITES_ROOT: root, NEXTAUTH_URL: 'https://actquest.ru', ...overrides }
  let session = { user: { id: 'fixture-admin', role: 'admin' } }
  const load = loader(env, { 'next/server': { NextResponse: Response }, 'next-auth': { getServerSession: async () => session }, '@server/auth/authOptions': { authOptions: {} }, ...mocks })
  return { root, env, load, role: role => { session = role ? { user: { id: 'fixture-user', role } } : null }, api: () => load('@app/api/cabinet/admin/mini-sites/route'), store: () => load('@server/miniSites/storage') }
}
// Только создание тестовых ZIP стандартной библиотекой; production не вызывает Python.
export function zip(entries = [{ name: 'index.html', text: '<h1>Первый</h1>' }]) {
  const result = spawnSync('python3', ['-c', `import sys,json,zipfile,io
b=io.BytesIO()
with zipfile.ZipFile(b,'w',zipfile.ZIP_DEFLATED) as z:
 for e in json.load(sys.stdin):
  i=zipfile.ZipInfo(e['name']);i.create_system=3;i.external_attr=e.get('mode',0o100644)<<16;i.compress_type=zipfile.ZIP_DEFLATED
  z.writestr(i,e.get('text','x').encode())
sys.stdout.buffer.write(b.getvalue())`], { input: JSON.stringify(entries), maxBuffer: 30 * 1024 * 1024 })
  if (result.status) throw new Error(String(result.stderr))
  return result.stdout
}
export function upload(buffer = zip(), fields = { action: 'create', slug: 'test-site', name: 'Тестовый сайт' }, headers = {}) {
  const body = new FormData()
  for (const [key, value] of Object.entries(fields)) body.append(key, value)
  body.append('archive', new Blob([buffer], { type: 'application/zip' }), 'site.zip')
  return new Request('http://localhost/api/cabinet/admin/mini-sites', { method: 'POST', headers: { Origin: 'https://actquest.ru', ...headers }, body })
}
export function action(slug, action, extra = {}, headers = {}) {
  return new Request('http://localhost/api/cabinet/admin/mini-sites', { method: 'PATCH', headers: { Origin: 'https://actquest.ru', 'Content-Type': 'application/json', ...headers }, body: JSON.stringify({ slug, action, ...extra }) })
}
