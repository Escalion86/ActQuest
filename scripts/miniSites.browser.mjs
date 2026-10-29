import assert from 'node:assert/strict'
import { writeFile, readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { output, zip } from './miniSites.fixture.mjs'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.MINI_SITES_PLAYWRIGHT || '/home/aleksei/projects/ux-ui-agent-skills/node_modules/playwright')
const base = process.env.MINI_SITES_TEST_BASE || 'http://127.0.0.1:3293'
const browser = await chromium.launch({ executablePath: process.env.MINI_SITES_CHROMIUM || '/home/aleksei/.cache/ms-playwright/chromium-1243/chrome-linux-arm64/chrome', headless: true, args: ['--no-sandbox', '--no-zygote', '--single-process', '--disable-gpu'] })
const checks = [], errors = [], consoleErrors = []
const pass = message => { checks.push(message); console.log('PASS', message) }
try {
  const context = await browser.newContext({ locale: 'ru-RU', permissions: ['clipboard-read', 'clipboard-write'] })
  const page = await context.newPage()
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()) })
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort())
  for (const width of [390, 1280]) for (const theme of ['light', 'dark']) {
    await page.setViewportSize({ width, height: 960 })
    await page.addInitScript(theme => localStorage.setItem('cabinet-theme', theme), theme)
    await page.goto(base + '/cabinet/admin/mini-sites', { waitUntil: 'networkidle' })
    assert.match(await page.title(), /изолированный стенд/)
    await page.getByRole('heading', { name: 'HTML мини-сайты', exact: true }).waitFor()
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), theme)
    const slug = `browser-${width}-${theme}`
    await page.getByLabel('Название', { exact: true }).fill(`Сайт ${slug}`)
    await page.getByLabel('Короткий адрес', { exact: true }).fill('INVALID')
    assert.equal(await page.getByLabel('Короткий адрес', { exact: true }).evaluate(el => el.checkValidity()), false)
    await page.getByLabel('Короткий адрес', { exact: true }).fill(slug)
    assert.equal(await page.getByLabel('Короткий адрес', { exact: true }).evaluate(el => el.checkValidity()), true)
    await page.getByLabel('ZIP-архив', { exact: true }).setInputFiles({ name: 'good.zip', mimeType: 'application/zip', buffer: zip([{ name: 'wrap/index.html', text: '<h1>В браузере</h1>' }, { name: 'wrap/app.js', text: 'document.title="Мини-сайт"' }, { name: 'wrap/style.css', text: 'body{color:blue}' }]) })
    await page.getByRole('button', { name: 'Опубликовать мини-сайт', exact: true }).click()
    const card = page.getByRole('article', { name: `Мини-сайт Сайт ${slug}` })
    await card.waitFor(); assert.equal(await card.getByText('Включён', { exact: true }).isVisible(), true)
    await card.getByRole('button', { name: 'Копировать ссылку' }).click()
    await page.getByRole('status').filter({ hasText: 'Ссылка скопирована.' }).waitFor()
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), `https://${slug}.actquest.ru`)
    await card.getByLabel(`Заменить ZIP (${slug})`).setInputFiles({ name: 'bad.zip', mimeType: 'application/zip', buffer: Buffer.from('bad zip') })
    await card.getByRole('button', { name: 'Заменить архив', exact: true }).click()
    await page.getByRole('alert').filter({ hasText: 'ZIP' }).waitFor()
    assert.equal(await card.getByLabel(`Заменить ZIP (${slug})`).evaluate(el => el.files[0].name), 'bad.zip')
    assert.equal(await card.getByText('Включён', { exact: true }).isVisible(), true)
    assert.equal(await card.getByRole('button', { name: 'Откатить версию' }).isDisabled(), true)
    await card.getByLabel(`Заменить ZIP (${slug})`).setInputFiles({ name: 'new.zip', mimeType: 'application/zip', buffer: zip([{ name: 'index.html', text: 'Новая версия' }]) })
    await card.getByRole('button', { name: 'Заменить архив', exact: true }).click()
    await page.getByRole('status').filter({ hasText: 'Изменения сохранены' }).waitFor()
    await card.getByRole('button', { name: 'Отключить', exact: true }).click()
    await card.getByText('Отключён', { exact: true }).waitFor()
    await card.getByRole('button', { name: 'Откатить версию' }).click()
    await page.getByRole('status').filter({ hasText: 'Изменения сохранены' }).waitFor()
    assert.equal(await card.getByText('Отключён', { exact: true }).isVisible(), true)
    assert.match(await card.innerText(), /Файлов: 3/)
    await card.getByRole('button', { name: 'Включить', exact: true }).click()
    await card.getByText('Включён', { exact: true }).waitFor()
    assert.equal(await card.locator('a').getAttribute('href'), `https://${slug}.actquest.ru`)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    const small = await page.locator('[aria-busy]').locator('button,a,input').evaluateAll(nodes => nodes.filter(node => !node.disabled && (node.getBoundingClientRect().height < 44 || node.getBoundingClientRect().width < 44)).map(node => ({ text: node.textContent, height: node.getBoundingClientRect().height, width: node.getBoundingClientRect().width })))
    assert.deepEqual(small, [])
    await page.getByRole('heading', { name: 'Новый мини-сайт', exact: true }).scrollIntoViewIfNeeded()
    await page.screenshot({ path: `${output}/mini-sites-${width}-${theme}-form.png`, fullPage: true })
    await card.scrollIntoViewIfNeeded()
    await page.screenshot({ path: `${output}/mini-sites-${width}-${theme}.png`, fullPage: true })
    // Экспорт реального отрисованного DOM со встроенным настоящим CSS, без исполнения приложения.
    const css = await readFile(`${output}/browser.css`, 'utf8')
    const html = await page.evaluate(css => { const clone = document.documentElement.cloneNode(true); clone.querySelectorAll('script,link[rel=stylesheet]').forEach(n => n.remove()); const style = document.createElement('style'); style.textContent = css; clone.querySelector('head').append(style); return '<!doctype html>' + clone.outerHTML }, css)
    await writeFile(`${output}/rendered-${width}-${theme}.html`, html)
    pass(`${width}px ${theme}: настоящие загрузка/ошибка/замена/отключение/откат/включение/clipboard, стабильная ссылка, без overflow, цели >=44px`)
  }
  // Отказ Clipboard API честно сообщает ручной способ, вместо ложного успеха.
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw Error('denied') } } }))
  await page.getByRole('article').last().getByRole('button', { name: 'Копировать ссылку' }).click()
  await page.getByRole('alert').filter({ hasText: 'Выделите и скопируйте адрес вручную' }).waitFor()
  pass('отказ clipboard: честный ручной fallback')
  assert.deepEqual(errors, [])
  // HTTP 400 для намеренно плохого ZIP — ожидаемые network errors Chromium.
  const unexpected = consoleErrors.filter(message => !message.includes('400 (Bad Request)'))
  assert.deepEqual(unexpected, [])
  pass('нет ошибок React/JS, framework overlay и неожиданных console errors')
  await writeFile(`${output}/browser-results.json`, JSON.stringify({ checks, errors, consoleErrors, boundary: 'Настоящие компонент, CabinetLayout, CabinetButton, CSS и handlers; admin-сессия — фикстура; настоящее временное файловое хранилище. Публичный nginx/DNS/TLS не настроены и не проверялись.' }, null, 2))
} finally { await browser.close() }
