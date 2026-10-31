// Настоящие CabinetLayout, React и CSS; только сессия, Next hooks/Link и API — фикстуры.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const root = process.cwd()
export const output = path.resolve(process.env.MINI_SITES_NAV_OUTPUT || path.join(os.tmpdir(), 'actquest-navigation'))
export const target = '/cabinet/admin/mini-sites'
export const label = 'HTML мини-сайты'
export const { chromium } = require(process.env.MINI_SITES_PLAYWRIGHT || 'playwright')
export const launchBrowser = () => chromium.launch({
  executablePath: process.env.MINI_SITES_CHROMIUM || undefined,
  headless: true,
  args: ['--no-sandbox', '--no-zygote', '--disable-gpu'],
})

export async function startHarness() {
  await mkdir(output, { recursive: true })
  const mock = path.join(output, 'fixture.jsx')
  await writeFile(mock, `
const fixture = window.__NAV_FIXTURE__;
const session = {user:{id:'fixture-'+fixture.role,role:fixture.role,name:'Роль '+fixture.role+' (фикстура)',location:'krsk'}};
const router = {replace(){},refresh(){},push(){},prefetch(){}};
const params = new URLSearchParams();
export const useSession = () => ({data:session,status:'authenticated',update:async()=>session});
export const signOut = async()=>{};
export const useRouter = () => router;
export const usePathname = () => location.pathname;
export const useSearchParams = () => params;
export const useBootstrapTheme = () => localStorage.getItem('cabinet-theme') || 'light';
export default function Link({href,children,onClick,...props}) {
  return <a {...props} href={href} onClick={event=>{onClick?.(event);event.preventDefault()}}>{children}</a>
}
`)
  const loader = path.join(output, 'loader.cjs')
  await writeFile(loader, `const swc = require(${JSON.stringify(require.resolve('next/dist/build/swc'))});
module.exports = function(source) { return swc.transformSync(source, {filename:this.resourcePath,jsc:{parser:{syntax:'ecmascript',jsx:true},transform:{react:{runtime:'automatic'}}},module:{type:'es6'}}).code }`)
  const entry = path.join(output, 'entry.jsx')
  await writeFile(entry, `import React from 'react';import {createRoot} from 'react-dom/client';
import CabinetLayout from ${JSON.stringify(path.join(root, 'components/cabinet/CabinetLayout.js'))};
createRoot(document.getElementById('root')).render(<CabinetLayout title="Проверка навигации"><p>Явная фикстура роли: {window.__NAV_FIXTURE__.role}. NextAuth не проверяется.</p></CabinetLayout>);`)
  const alias = Object.fromEntries(['app', 'helpers', 'server', 'utils'].map(name => ['@' + name, path.join(root, name)]))
  for (const name of ['next-auth/react', 'next/navigation', 'next/link', '@app/providers']) alias[name + '$'] = mock
  const webpack = require('next/dist/compiled/webpack/webpack').webpack
  await new Promise((resolve, reject) => {
    const compiler = webpack({mode:'development',devtool:false,context:root,entry,output:{path:output,filename:'browser.js'},resolve:{alias:Object.fromEntries(Object.entries(alias).sort(([a],[b])=>b.length-a.length)),modules:[path.join(root,'node_modules')],extensions:['.js','.jsx','.json']},module:{rules:[{test:/\.(js|jsx)$/,exclude:/node_modules/,use:loader}]}})
    compiler.run((error, stats) => compiler.close(closeError => error || closeError || stats.hasErrors() ? reject(error || closeError || new Error(stats.toString({all:false,errors:true}))) : resolve()))
  })
  const css = await require('postcss')([require('@tailwindcss/postcss')({base:root})]).process(await readFile(path.join(root,'styles/global.css'),'utf8'),{from:path.join(root,'styles/global.css')})
  await writeFile(path.join(output,'browser.css'),css.css)
  const server = createServer(async (req,res) => {
    try {
      const url = new URL(req.url,'http://localhost')
      if (['/browser.js','/browser.css'].includes(url.pathname)) {
        res.setHeader('Content-Type',url.pathname.endsWith('.css')?'text/css':'application/javascript')
        res.end(await readFile(path.join(output,url.pathname.slice(1)))); return
      }
      if (url.pathname.startsWith('/api/')) {
        res.setHeader('Content-Type','application/json');res.end(JSON.stringify({success:true,data:{count:0}}));return
      }
      if (url.pathname.startsWith('/img/')) {
        res.setHeader('Content-Type','image/png');res.end(await readFile(path.join(root,'public',url.pathname)));return
      }
      const role = url.searchParams.get('fixtureRole') || 'client'
      assert.ok(['dev','admin','client','agent','moder','ban'].includes(role),'Неизвестная роль фикстуры')
      res.setHeader('Content-Type','text/html; charset=utf-8')
      res.end(`<!doctype html><html lang="ru"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Навигация — фикстура ${role}</title><link rel="stylesheet" href="/browser.css"></head><body><div id="root"></div><script>window.process={env:{NODE_ENV:'development'}};window.__NAV_FIXTURE__=${JSON.stringify({role})}</script><script src="/browser.js"></script></body></html>`)
    } catch (error) { res.writeHead(500);res.end(String(error)) }
  })
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
  return {base:`http://127.0.0.1:${server.address().port}`,close:()=>new Promise(resolve=>server.close(resolve))}
}

export async function openFixture(browser, base, {role, width=1280, theme='light', route=target}) {
  const context = await browser.newContext({viewport:{width,height:960},locale:'ru-RU'})
  await context.addInitScript(theme=>localStorage.setItem('cabinet-theme',theme),theme)
  const page = await context.newPage()
  const errors = []
  page.on('pageerror',error=>errors.push(error.message))
  page.on('console',message=>{if(message.type()==='error') errors.push(message.text())})
  await page.route('**/*',request=>new URL(request.request().url()).hostname==='127.0.0.1'?request.continue():request.abort())
  await page.goto(`${base}${route}?fixtureRole=${role}`,{waitUntil:'networkidle'})
  await page.getByText(`Явная фикстура роли: ${role}.`,{exact:false}).waitFor()
  return {context,page,errors}
}

async function assertTransactionsFullyVisible(page) {
  const link = page.getByRole('link',{name:'Транзакции',exact:true})
  const submenu = link.locator('xpath=ancestor::div[@aria-hidden][1]')
  await submenu.evaluate(async el=>{await Promise.all(el.getAnimations().map(animation=>animation.finished))})
  // Прокручиваем только общий nav: scrollIntoView мог бы скрытно прокрутить overflow-hidden подменю.
  await link.evaluate(el=>{
    const nav=el.closest('nav'), rect=el.getBoundingClientRect(), visible=nav.getBoundingClientRect()
    if(rect.bottom>visible.bottom) nav.scrollBy(0,rect.bottom-visible.bottom+8)
  })
  const bounds = await link.evaluate(el=>({
    link:el.getBoundingClientRect().toJSON(),
    submenu:el.closest('div[aria-hidden]').getBoundingClientRect().toJSON(),
    nav:el.closest('nav').getBoundingClientRect().toJSON(),
  }))
  assert.ok(bounds.link.top>=bounds.submenu.top && bounds.link.bottom<=bounds.submenu.bottom+1,
    `«Транзакции» обрезаны подменю: низ ссылки ${bounds.link.bottom}, низ подменю ${bounds.submenu.bottom}`)
  assert.ok(bounds.link.top>=bounds.nav.top && bounds.link.bottom<=bounds.nav.bottom+1,
    '«Транзакции» должны полностью помещаться в видимой области общего сайдбара')
  await link.click({trial:true})
  return bounds
}

async function browserMatrix() {
  const harness = await startHarness()
  const browser = await launchBrowser()
  const results = []
  try {
    for (const role of ['dev','admin']) for (const width of [390,1280]) for (const theme of ['light','dark']) {
      const {context,page,errors} = await openFixture(browser,harness.base,{role,width,theme})
      try {
        const menu = page.getByRole('button',{name:'Открыть меню',exact:true})
        const sidebar = page.locator('nav').locator('../..')
        if (width===390) {
          await page.waitForFunction(()=>document.querySelector('nav').parentElement.parentElement.getBoundingClientRect().right<=1)
          await menu.click()
          await page.waitForFunction(()=>Math.abs(document.querySelector('nav').parentElement.parentElement.getBoundingClientRect().left)<1)
        }
        const group = page.getByRole('button',{name:'Администрирование',exact:true})
        await group.click()
        assert.equal(await group.locator('..').locator('div[aria-hidden]').getAttribute('aria-hidden'),'true')
        await group.click()
        const link = page.getByRole('link',{name:label,exact:true})
        assert.equal(await link.count(),1)
        assert.equal(await link.getAttribute('href'),target)
        await link.scrollIntoViewIfNeeded()
        assert.ok(await link.isVisible())
        // Проверка попадания мышью учитывает обрезание родительским max-height и перекрытия.
        await link.click({trial:true})
        const transactions = await assertTransactionsFullyVisible(page)
        const active = await link.evaluate(el=>({bg:getComputedStyle(el).backgroundColor,color:getComputedStyle(el).color,rect:el.getBoundingClientRect().toJSON()}))
        const idle = await page.getByRole('link',{name:'Отзывы об играх',exact:true}).evaluate(el=>({bg:getComputedStyle(el).backgroundColor,color:getComputedStyle(el).color}))
        assert.notEqual(active.bg,idle.bg)
        assert.notEqual(active.color,idle.color)
        assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),theme)
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
        const stem = `${role}-${width}-${theme}`
        await page.screenshot({path:path.join(output,`${stem}.png`),fullPage:true})
        const css = await readFile(path.join(output,'browser.css'),'utf8')
        const html = await page.evaluate(css=>{const clone=document.documentElement.cloneNode(true);clone.querySelectorAll('script,link[rel=stylesheet]').forEach(el=>el.remove());const style=document.createElement('style');style.textContent=css;clone.querySelector('head').append(style);return '<!doctype html>'+clone.outerHTML},css)
        await writeFile(path.join(output,`rendered-${stem}.html`),html)
        if (width===390) {
          await link.click()
          await page.waitForFunction(()=>document.querySelector('nav').parentElement.parentElement.getBoundingClientRect().right<=1)
          await menu.click()
          await page.waitForFunction(()=>Math.abs(document.querySelector('nav').parentElement.parentElement.getBoundingClientRect().left)<1)
          await page.locator('.fixed.inset-0.z-30').click({position:{x:width-10,y:100}})
          await page.waitForFunction(()=>document.querySelector('nav').parentElement.parentElement.getBoundingClientRect().right<=1)
          await page.screenshot({path:path.join(output,`${stem}-closed.png`)})
        } else assert.equal(Math.round((await sidebar.boundingBox()).width),256)
        assert.deepEqual(errors,[])
        results.push({role,width,theme,status:'PASS',active,transactions})
        console.log(`PASS ${role} ${width}px ${theme}: ссылка, единственность, href, подсветка, раскрытие, overflow, «Транзакции» полностью видимы${width===390?', открытие/закрытие шторки ссылкой и фоном':''}`)
      } finally {await context.close()}
    }
    await writeFile(path.join(output,'browser-results.json'),JSON.stringify({boundary:'Настоящие CabinetLayout/React/CSS. Роли — фикстуры; NextAuth, БД, сервер Next и деплой не проверяются.',results},null,2))
  } finally {await browser.close();await harness.close()}
}
if (process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) await browserMatrix()
