// Изолированный браузерный стенд: реальные JSX и CSS, явные mocks сессии/API.
// Никаких Next-сервера, env-файлов, БД и запросов к провайдеру.
import { createRequire } from 'node:module'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import path from 'node:path'
const require = createRequire(import.meta.url)
const output = process.env.PHONE_TEST_OUTPUT
if (!output) throw new Error('PHONE_TEST_OUTPUT должен указывать в scratch')
await mkdir(output, { recursive: true })
const root = process.cwd()
const mocks = `import React from ${JSON.stringify(path.join(root, 'node_modules/react/index.js'))};
export const useSession = () => ({ status: location.pathname === '/profile' ? 'authenticated' : 'unauthenticated', data: location.pathname === '/profile' ? { user: { id: 'me', role: 'client', location: 'krsk' } } : null, update: async () => {} });
export const signIn = async () => ({ ok: true });
export const useRouter = () => ({replace() {}}); export const usePathname = () => location.pathname; export const useSearchParams = () => new URLSearchParams();
export default function Mock(props) { if (props.isOpen === false || props.open === false) return null; if (props.href) return <a href={props.href}>{props.children}</a>; return <section>{props.children}{props.footer}</section> }
`
await writeFile(path.join(output, 'mocks.jsx'), mocks)
await writeFile(path.join(output, 'pwa.js'), 'export default () => ({})')
await writeFile(path.join(output, 'swc-loader.cjs'), `const swc = require(${JSON.stringify(require.resolve('next/dist/build/swc'))}); module.exports = function(source) { return swc.transformSync(source, { filename: this.resourcePath, jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'es6' } }).code }`)
await writeFile(path.join(output, 'entry.jsx'), `import React from 'react'; import {createRoot} from 'react-dom/client';
import Setting from ${JSON.stringify(path.join(root, 'components/cabinet/PhoneVerificationPrioritySetting.js'))};
import Register from ${JSON.stringify(path.join(root, 'components/cabinet/app-router/CabinetRegisterPageClient.js'))};
import Profile from ${JSON.stringify(path.join(root, 'components/cabinet/app-router/ProfilePageClient.js'))};
const kind = location.pathname;
createRoot(document.getElementById('root')).render(kind === '/settings' ? <Setting/> : kind === '/profile' ? <Profile initialProfile={{id:'me', name:'Тест', phone:'79000000000', currentLocation:'krsk'}}/> : <Register authIntent={kind === '/recovery' ? 'recovery' : 'register'} isVkAuthVisible={false}/>);
`)
const aliases = Object.fromEntries(['components', 'helpers', 'server', 'utils', 'schemas', 'state', 'lib'].map(name => [`@${name}`, path.join(root, name)]))
for (const name of ['next-auth/react', 'next/navigation', 'next/link', '@components/cabinet/CabinetLayout', '@components/cabinet/ImagesInput', '@components/FeedbackToast']) aliases[name+'$'] = path.join(output, 'mocks.jsx')
aliases['@helpers/usePwaNotifications$'] = path.join(output, 'pwa.js')
const webpack = require('next/dist/compiled/webpack/webpack').webpack
await new Promise((resolve, reject) => webpack({ mode: 'development', devtool: false, context: root, entry: path.join(output, 'entry.jsx'), output: { path: output, filename: 'browser.js' }, resolve: { alias: Object.fromEntries(Object.entries(aliases).sort(([a], [b]) => b.length - a.length)), modules: [path.join(root, 'node_modules')], extensions: ['.js', '.jsx', '.json'] }, module: { rules: [{ test: /\.(js|jsx)$/, exclude: /node_modules/, use: path.join(output, 'swc-loader.cjs') }] } }, (err, stats) => err || stats.hasErrors() ? reject(err || new Error(stats.toString({ all: false, errors: true }))) : resolve()))
const postcss = require('postcss'), tailwind = require('@tailwindcss/postcss')
const css = await postcss([tailwind({ base: root })]).process(await readFile(path.join(root, 'styles/global.css'), 'utf8'), { from: path.join(root, 'styles/global.css') })
await writeFile(path.join(output, 'browser.css'), css.css)
const server = createServer(async (req, res) => {
  if (req.url === '/__stop' && req.method === 'POST') { res.end('stopped'); server.close(() => process.exit(0)); return }
  if (req.url === '/browser.js' || req.url === '/browser.css') { res.setHeader('Content-Type', req.url.endsWith('.css') ? 'text/css' : 'application/javascript'); res.end(await readFile(path.join(output, req.url.slice(1)))); return }
  if (req.url.startsWith('/api/')) { res.writeHead(501, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false, error: 'Нужен явный mock API' })); return }
  res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/browser.css"></head><body><main id="root" style="max-width:1000px;margin:auto;padding:16px"></main><script>window.process={env:{NODE_ENV:"development"}}</script><script src="/browser.js"></script></body></html>')
}).listen(Number(process.env.PHONE_TEST_PORT || 3290), '127.0.0.1', () => console.log('Изолированный JSX-стенд готов'))
