import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

// Проверка на собственном локальном сервере. Playwright устанавливается отдельно от проекта.
const base = process.env.ASSISTANT_TEST_BASE || 'http://127.0.0.1:3278'
const output = process.env.ASSISTANT_TEST_OUTPUT
if (!output) throw new Error('Укажите ASSISTANT_TEST_OUTPUT в scratch: отчёты не пишутся в репозиторий')
await mkdir(output, { recursive: true })
const specifier = process.env.ASSISTANT_PLAYWRIGHT_MODULE || 'playwright'
const { chromium } = await import(specifier.startsWith('/') ? pathToFileURL(specifier).href : specifier)
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'], ...(process.env.ASSISTANT_CHROMIUM_PATH ? { executablePath: process.env.ASSISTANT_CHROMIUM_PATH } : {}) })
const checks = []
function pass(text) { checks.push(text); console.log(`PASS ${text}`) }
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push({ url: page.url(), message: error.message }))
  await page.goto(`${base}/`, { waitUntil: 'networkidle' })
  const launcher = page.getByRole('button', { name: 'Открыть помощника ActQuest' })
  await launcher.waitFor()
  assert.equal(await page.getByRole('dialog', { name: 'Помощник ActQuest' }).count(), 0)
  pass('desktop: виджет виден и не открывается автоматически')
  await launcher.click()
  const panel = page.getByRole('dialog', { name: 'Помощник ActQuest' })
  const input = page.getByLabel('Ваш вопрос об ActQuest')
  await panel.getByText('В каком городе хотите играть?', { exact: true }).waitFor()
  assert.equal(await input.count(), 0)
  assert.equal(await panel.getByRole('button').count(), 4)
  const chooseCity = panel.getByRole('button', { name: 'Красноярск', exact: true })
  assert.equal(await panel.evaluate((node) => node === document.activeElement), true)
  await chooseCity.click()
  await input.waitFor()
  assert.equal(await input.evaluate((node) => node === document.activeElement), false)
  assert.equal(await panel.getByRole('button').count(), 8)
  pass('явный выбор города до формы, затем шесть быстрых вопросов без фокуса поля')
  await panel.getByRole('button', { name: 'Что такое автоквест?', exact: true }).click()
  await panel.getByText('Помощник', { exact: true }).waitFor()
  assert.match(await panel.getByRole('log').innerText(), /Автоквест ActQuest/)
  assert.equal(await input.evaluate((node) => node === document.activeElement), false)
  pass('реальный API: детерминированный FAQ без вызова модели и автофокуса')
  await page.keyboard.press('Escape')
  await panel.waitFor({ state: 'hidden' })
  assert.equal(await launcher.evaluate((node) => node === document.activeElement), true)
  pass('Escape закрывает окно и возвращает фокус')

  // Здесь проверяем UI успешного ответа и загрузки с явно подменённым сетевым ответом.
  let payload
  await page.route('**/api/assistant', async (route) => {
    payload = route.request().postDataJSON()
    await new Promise((resolve) => setTimeout(resolve, 500))
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, mode: 'ai', answer: 'Автоквест — городская игра по проверенным источникам.', links: [{ title: 'Ближайшие игры', href: '/cabinet/games-upcoming' }] }) })
  })
  await launcher.click(); await input.fill('Как записаться на игру?'); await panel.getByRole('button', { name: 'Отправить', exact: true }).click()
  await panel.getByRole('status').waitFor()
  assert.equal(await panel.getByRole('button', { name: 'Отправить', exact: true }).isDisabled(), true)
  await panel.getByRole('link', { name: 'Ближайшие игры', exact: true }).waitFor()
  assert.equal(payload.city, 'krsk'); assert.equal(payload.question, 'Как записаться на игру?')
  assert.equal(await panel.getByRole('link', { name: 'Ближайшие игры', exact: true }).getAttribute('href'), '/cabinet/games-upcoming')
  pass('свободный вопрос, загрузка, блокировка дубля и ссылки (mock ответа)')
  const close = panel.getByRole('button', { name: 'Закрыть помощника' })
  await close.focus(); await page.keyboard.press('Shift+Tab')
  assert.equal(await page.getByRole('button', { name: 'Отправить', exact: true }).evaluate((node) => node === document.activeElement), false)
  // Пустая форма отключает отправку; последним доступным элементом становится textarea.
  assert.equal(await input.evaluate((node) => node === document.activeElement), true)
  await page.keyboard.press('Tab')
  assert.equal(await close.evaluate((node) => node === document.activeElement), true)
  pass('перемещение фокуса Tab и Shift+Tab внутри окна')
  await page.screenshot({ path: `${output}/desktop.png` })
  await close.click(); await panel.waitFor({ state: 'hidden' })
  assert.equal(await launcher.evaluate((node) => node === document.activeElement), true)
  await page.unroute('**/api/assistant')

  for (const path of ['/articles?testai=true', '/game/123456789012345678901234/process/x?testai=true', '/game/123456789012345678901234/test/x?testai=true', '/game/123456789012345678901234?testai=true', '/krsk/game/123456789012345678901234?testai=true']) {
    // На входе возможны фоновые запросы авторизации; ждём сам launcher ниже,
    // а не прекращение всей сетевой активности страницы.
    await page.goto(`${base}${path}`, { waitUntil: path.includes('/test/') ? 'domcontentloaded' : 'networkidle' })
    if (path.includes('/test/')) {
      // Без сессии это не игровой экран: штатный сервер переводит на вход в кабинет.
      assert.equal(new URL(page.url()).pathname, '/cabinet/login')
      assert.equal(new URL(page.url()).searchParams.get('callbackUrl'), path.split('?')[0])
      await launcher.waitFor()
      assert.equal(await launcher.count(), 1)
      pass('test-экран защищён: гость переведён на вход в кабинет; скрытие игрового mount проверяет отдельный сценарий')
    } else {
      assert.equal(await page.getByRole('button', { name: 'Открыть помощника ActQuest' }).count(), 0)
      pass(`виджет отсутствует: ${path}`)
    }
  }
  for (const path of ['/krsk', '/nrsk', '/ekb']) {
    await page.goto(`${base}${path}`, { waitUntil: 'networkidle' }); await launcher.waitFor(); await launcher.click()
    const city = path.split('?')[0].slice(1)
    await panel.getByText('В каком городе хотите играть?', { exact: true }).waitFor()
    assert.equal(await page.getByLabel('Город помощника').count(), 0)
    const title = { krsk: 'Красноярск', nrsk: 'Норильск', ekb: 'Екатеринбург' }[city]
    await panel.getByRole('button', { name: title, exact: true }).click()
    assert.equal(await page.getByLabel('Город помощника').inputValue(), city)
    await page.keyboard.press('Escape'); pass(`главная города: ${city}`)
  }
  await page.goto(`${base}/krasnoyarsk?testai=true`, { waitUntil: 'networkidle' }); await launcher.waitFor()
  assert.equal(new URL(page.url()).pathname, '/krsk'); assert.equal(new URL(page.url()).searchParams.get('testai'), 'true')
  pass('реальный серверный редирект городского алиаса сохраняет testai=true')
  await page.goto(`${base}/`, { waitUntil: 'networkidle' }); await launcher.waitFor()
  await page.evaluate(() => { history.pushState(null, '', '/'); window.dispatchEvent(new PopStateEvent('popstate')) })
  await launcher.waitFor(); await page.reload({ waitUntil: 'networkidle' })
  await launcher.waitFor()
  assert.equal(await launcher.count(), 1)
  const storage = await page.evaluate(() => ({ keys: Object.keys(localStorage), cookies: document.cookie }))
  assert.ok(!storage.keys.some((key) => /assistant|testai/i.test(key))); assert.doesNotMatch(storage.cookies, /testai|assistant/i)
  pass('флаг не влияет на доступность; диалог не сохраняется в storage/cookies')
  await context.close()

  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  const mobile = await mobileContext.newPage()
  await mobile.goto(`${base}/?testai=true`, { waitUntil: 'networkidle' }); await mobile.getByRole('button', { name: 'Открыть помощника ActQuest' }).click()
  const mobilePanel = mobile.getByRole('dialog', { name: 'Помощник ActQuest' })
  const box = await mobilePanel.boundingBox(); assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= 390 && box.y + box.height <= 844)
  assert.equal(await mobilePanel.evaluate(node => node === document.activeElement), true)
  const noMobileInputFocus = async () => assert.equal(await mobile.evaluate(() => ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)), false)
  await noMobileInputFocus()
  await mobilePanel.getByRole('button', { name: 'Красноярск', exact: true }).click()
  await noMobileInputFocus()
  let mobilePayload
  const gameId = '123456789012345678901234'
  await mobile.route('**/api/assistant', async route => {
    mobilePayload = route.request().postDataJSON()
    const details = mobilePayload.question === 'Подробнее об игре'
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, mode: 'faq', answer: details ? 'Гарри — подробности игры.' : 'Выберите игру.', games: details ? [] : [{ gameId, title: 'Гарри', href: `/game/${gameId}` }], links: [] }) })
  })
  await mobilePanel.getByRole('button', { name: 'Какие ближайшие игры?', exact: true }).click()
  await mobilePanel.getByText('Нажмите на игру, чтобы узнать подробности', { exact: true }).waitFor()
  await noMobileInputFocus()
  assert.equal(await mobilePanel.getByRole('button', { name: /^Выбрать:/ }).count(), 0)
  await mobilePanel.getByRole('button', { name: 'Гарри', exact: true }).click()
  await mobilePanel.getByText('Гарри — подробности игры.', { exact: true }).waitFor()
  assert.equal(mobilePayload.question, 'Подробнее об игре'); assert.equal(mobilePayload.gameId, gameId)
  await noMobileInputFocus()
  await mobilePanel.getByRole('button', { name: 'Как записаться?', exact: true }).click()
  await mobilePanel.getByText('Помощник', { exact: true }).last().waitFor()
  await mobile.waitForFunction(() => document.querySelector('[role=log]')?.getAttribute('aria-busy') === 'false')
  assert.equal(mobilePayload.question, 'Как записаться?'); assert.equal(mobilePayload.gameId, gameId)
  await noMobileInputFocus()
  const mobileInput = mobile.getByLabel('Ваш вопрос об ActQuest')
  await mobileInput.tap()
  assert.equal(await mobileInput.evaluate(node => node === document.activeElement), true)
  await mobileInput.fill('Можно без команды?')
  pass('mobile: open/city/FAQ/details/response без фокуса поля; карточка и следующая запись используют ту же игру (mock); ручной тап работает')
  await mobile.screenshot({ path: `${output}/mobile.png` })
  await mobile.getByRole('button', { name: 'Закрыть помощника' }).click()
  await mobilePanel.waitFor({ state: 'hidden' }); pass('mobile 390×844: окно помещается, поле доступно, закрытие работает')
  await mobile.setViewportSize({ width: 320, height: 568 }); await mobile.getByRole('button', { name: 'Открыть помощника ActQuest' }).click()
  const smallBox = await mobilePanel.boundingBox(); assert.ok(smallBox.x >= 0 && smallBox.y >= 0 && smallBox.x + smallBox.width <= 320 && smallBox.y + smallBox.height <= 568)
  pass('mobile 320×568: окно помещается в узкий экран')
  await mobileContext.close()
  assert.deepEqual(errors, []); pass('нет ошибок React/JavaScript на проверенных страницах')
  await writeFile(`${output}/browser-results.json`, JSON.stringify({ base, checks, pageErrors: errors }, null, 2))
} finally { await browser.close() }
