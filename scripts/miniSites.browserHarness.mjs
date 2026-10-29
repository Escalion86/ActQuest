// Изолированный стенд: настоящие React/CabinetLayout/CabinetButton/CSS и API handlers.
// Сессия admin — явная фикстура, хранилище временное вне Git, БД/секретов нет.
import { createRequire } from 'node:module'
import { mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { createServer } from 'node:http'
import { Readable } from 'node:stream'
import path from 'node:path'
import { fixture, output } from './miniSites.fixture.mjs'
const require = createRequire(import.meta.url)
const root = process.cwd()
const port = Number(process.env.MINI_SITES_TEST_PORT || 3293)
const base = `http://127.0.0.1:${port}`
await mkdir(output, { recursive: true })
const f = await fixture({ NEXTAUTH_URL: base })
const api = f.api()
await writeFile(path.join(output, 'auth-fixture.jsx'), `export const fixtureSession = {user:{id:'fixture-admin',role:'admin',name:'Администратор (фикстура)',location:'krsk',photoUrl:'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2240%22 height=%2240%22%3E%3Crect width=%2240%22 height=%2240%22 fill=%22%23334155%22/%3E%3C/svg%3E'}};
export const useSession = () => ({ data:fixtureSession,status:'authenticated',update:async()=>fixtureSession });
export const signOut = async()=>{};
export const useRouter = () => ({replace(){},refresh(){},push(){},prefetch(){}});
export const usePathname = () => '/cabinet/admin/mini-sites';
const params = new URLSearchParams();export const useSearchParams = () => params;
export const useBootstrapTheme = () => 'light';
export default function Link({href,children,...props}){return <a href={href} {...props}>{children}</a>}
`)
await writeFile(path.join(output, 'swc-loader.cjs'), `const swc = require(${JSON.stringify(require.resolve('next/dist/build/swc'))}); module.exports = function(source) { return swc.transformSync(source, { filename: this.resourcePath, jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'es6' } }).code }`)
await writeFile(path.join(output, 'entry.jsx'), `import React from 'react'; import {createRoot} from 'react-dom/client';
import Component from ${JSON.stringify(path.join(root, 'components/cabinet/app-router/MiniSitesPageClient.js'))};
import {fixtureSession} from './auth-fixture.jsx';
createRoot(document.getElementById('root')).render(<Component session={fixtureSession} initialData={window.fixtureInitialData}/>);
`)
const aliases = Object.fromEntries(['app', 'components', 'helpers', 'server', 'utils', 'schemas', 'state', 'lib'].map(name => [`@${name}`, path.join(root, name)]))
for (const name of ['next-auth/react', 'next/navigation', 'next/link', '@app/providers']) aliases[name + '$'] = path.join(output, 'auth-fixture.jsx')
const webpack = require('next/dist/compiled/webpack/webpack').webpack
await new Promise((resolve, reject) => webpack({ mode: 'development', devtool: false, context: root, entry: path.join(output, 'entry.jsx'), output: { path: output, filename: 'browser.js' }, resolve: { alias: Object.fromEntries(Object.entries(aliases).sort(([a], [b]) => b.length - a.length)), modules: [path.join(root, 'node_modules')], extensions: ['.js', '.jsx', '.json'] }, module: { rules: [{ test: /\.(js|jsx)$/, exclude: /node_modules/, use: path.join(output, 'swc-loader.cjs') }] } }, (err, stats) => err || stats.hasErrors() ? reject(err || new Error(stats.toString({ all: false, errors: true }))) : resolve()))
const postcss = require('postcss'), tailwind = require('@tailwindcss/postcss')
const css = await postcss([tailwind({ base: root })]).process(await readFile(path.join(root, 'styles/global.css'), 'utf8'), { from: path.join(root, 'styles/global.css') })
await writeFile(path.join(output, 'browser.css'), css.css)
const server = createServer(async (req, res) => {
  try {
    if (req.url === '/__stop' && req.method === 'POST') { res.end('stopped'); server.close(async () => { await rm(f.root, { recursive: true, force: true }); process.exit(0) }); return }
    if (req.url === '/browser.js' || req.url === '/browser.css') { res.setHeader('Content-Type', req.url.endsWith('.css') ? 'text/css' : 'application/javascript'); res.end(await readFile(path.join(output, req.url.slice(1)))); return }
    if (req.url === '/api/cabinet/admin/mini-sites') {
      const request = new Request(base + req.url, { method: req.method, headers: req.headers, ...(req.method !== 'GET' ? { body: Readable.toWeb(req), duplex: 'half' } : {}) })
      const result = await api[req.method](request)
      res.writeHead(result.status, Object.fromEntries(result.headers)); res.end(Buffer.from(await result.arrayBuffer())); return
    }
    if (/^\/(fonts|img)\/[a-zA-Z0-9_./-]+$/.test(req.url) && !req.url.includes('..')) {
      try { const bytes = await readFile(path.join(root, 'public', req.url)); res.setHeader('Content-Type', req.url.endsWith('.png') ? 'image/png' : 'application/octet-stream'); res.end(bytes) } catch { res.writeHead(404); res.end() }
      return
    }
    if (req.url.startsWith('/api/')) { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ success: true, data: { count: 0, items: [] } })); return }
    const initial = await (await api.GET(new Request(base))).json()
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.end(`<!doctype html><html lang="ru"><head><title>HTML мини-сайты — изолированный стенд</title><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/browser.css"></head><body><div id="root"></div><script>window.process={env:{NODE_ENV:"development"}};window.fixtureInitialData=${JSON.stringify(initial.data).replaceAll('<', '\\u003c')}</script><script src="/browser.js"></script></body></html>`)
  } catch (error) { console.error(error); res.writeHead(500); res.end('Ошибка стенда') }
}).listen(port, '127.0.0.1', () => console.log(`Стенд ${base}; session=admin fixture; temp storage=${f.root}`))
