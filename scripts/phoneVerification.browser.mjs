import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
const output = process.env.PHONE_TEST_OUTPUT
if (!output) throw new Error('Укажите PHONE_TEST_OUTPUT в scratch')
const specifier = process.env.PHONE_PLAYWRIGHT_MODULE || 'playwright'
const { chromium } = await import(specifier.startsWith('/') ? pathToFileURL(specifier).href : specifier)
const base = process.env.PHONE_TEST_BASE || 'http://127.0.0.1:3290'
const browser = await chromium.launch({ headless: true, ...(process.env.PHONE_CHROMIUM_PATH ? { executablePath: process.env.PHONE_CHROMIUM_PATH } : {}), timeout: 15000, args: ['--no-sandbox', '--no-zygote', '--single-process', '--disable-gpu', '--disable-software-rasterizer'] })
const checks = [], errors = []
const pass = message => { checks.push(message); console.log(`PASS ${message}`) }
try {
  const page = await browser.newPage()
  page.on('pageerror', err => errors.push(err.message))
  // Запрещены все внешние запросы; сервер стенда не имеет обработчиков БД/провайдера.
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort())
  let selected = 'call', fail = false, failLoad = false, lastBody, holdSave = false, releaseSave
  await page.route('**/api/cabinet/settings', async route => {
    if (failLoad) return route.fulfill({ status: 500, json: { success: false } })
    if (route.request().method() === 'PATCH') {
      lastBody = route.request().postDataJSON()
      if (holdSave) await new Promise(resolve => { releaseSave = resolve })
      if (fail) return route.fulfill({ status: 403, json: { success: false } })
      selected = lastBody.phoneVerificationPrimaryMethod
    }
    return route.fulfill({ json: { success: true, data: { phoneVerificationPrimaryMethod: selected, allowSmsVerification: false } } })
  })
  for (const width of [360, 1440]) for (const theme of ['light', 'dark']) {
    selected = 'call'; fail = false; failLoad = false
    await page.setViewportSize({ width, height: 900 }); await page.goto(`${base}/settings`)
    await page.evaluate(theme => { document.documentElement.className = theme === 'dark' ? 'dark' : ''; document.documentElement.dataset.theme = theme }, theme)
    const call = page.getByRole('radio', { name: 'Звонок', exact: true }), sms = page.getByRole('radio', { name: 'СМС', exact: true })
    await call.waitFor(); await page.waitForFunction(() => !document.querySelector('fieldset').disabled)
    assert.equal(await call.isChecked(), true)
    holdSave = true; releaseSave = undefined
    await sms.click(); assert.equal(await call.isChecked(), true); assert.equal(await sms.isDisabled(), true)
    for (let i = 0; !releaseSave && i < 100; i++) await new Promise(resolve => setTimeout(resolve, 10))
    assert.ok(releaseSave); holdSave = false; releaseSave()
    await page.waitForFunction(() => !document.querySelector('fieldset').disabled); assert.equal(await sms.isChecked(), true)
    assert.deepEqual(lastBody, { phoneVerificationPrimaryMethod: 'sms' })
    await call.click(); await page.waitForFunction(() => !document.querySelector('fieldset').disabled); assert.equal(await call.isChecked(), true)
    fail = true; await sms.click(); await page.getByRole('alert').waitFor(); assert.equal(await call.isChecked(), true)
    fail = false; await sms.click(); await page.waitForFunction(() => !document.querySelector('fieldset').disabled); assert.equal(await sms.isChecked(), true)
    await page.reload(); await page.waitForFunction(() => !document.querySelector('fieldset').disabled); assert.equal(await sms.isChecked(), true)
    await page.evaluate(theme => { document.documentElement.className = theme === 'dark' ? 'dark' : ''; document.documentElement.dataset.theme = theme }, theme)
    assert.ok(await page.getByText('СМС сейчас отключены:', { exact: false }).isVisible())
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    await page.screenshot({ path: `${output}/settings-${width}-${theme}.png`, fullPage: true })
    pass(`настройка ${width}px ${theme}: загрузка, оба направления, ожидание, отказ, повтор, reload, SMS OFF, без overflow`)
  }
  failLoad = true; await page.reload(); await page.getByRole('alert').waitFor(); assert.equal(await page.getByRole('radio', { name: 'СМС', exact: true }).isDisabled(), true)
  failLoad = false; await page.getByRole('button', { name: 'Повторить загрузку' }).click(); await page.waitForFunction(() => !document.querySelector('fieldset').disabled)
  pass('ошибка GET и повтор загрузки')

  const requests = []
  await page.route('**/api/public/site-access**', route => route.fulfill({ json: { success: true, data: { allowSiteAuth: true, allowSiteRegistration: true, allowSmsVerification: true, enableVkOneTap: false } } }))
  await page.route('**/api/phone/verify/**', route => {
    const body = route.request().postDataJSON(); requests.push({ url: route.request().url(), body })
    const url = route.request().url()
    const data = url.endsWith('/precheck') ? { allowed: true } : url.endsWith('/sms/check') ? { status: 'ok' } : body.method === 'call' ? { method: 'call', id: 123, auth_phone: '88005553535' } : { method: 'sms', status: 'sms_pending' }
    return route.fulfill({ json: { success: true, data } })
  })
  await page.route('**/api/cabinet/users/change-phone', route => { requests.push({ url: route.request().url(), body: route.request().postDataJSON() }); return route.fulfill({ json: { success: true, data: { id: 'me', name: 'Тест', phone: '79001234567' } } }) })
  for (const width of [360, 1440]) for (const theme of ['light', 'dark']) for (const flow of ['register', 'recovery', 'profile']) {
    requests.length = 0; await page.setViewportSize({ width, height: 1000 }); await page.goto(`${base}/${flow}`)
    await page.evaluate(theme => { document.documentElement.className = theme === 'dark' ? 'dark' : ''; document.documentElement.dataset.theme = theme }, theme)
    if (flow === 'profile') await page.getByRole('button', { name: 'Изменить номер', exact: true }).click()
    else if (flow === 'register') await page.getByRole('combobox').selectOption('krsk')
    const phone = flow === 'profile' ? page.getByLabel('Новый номер телефона') : page.locator('input[type=tel]')
    await phone.fill('+7 900 123-45-67'); await page.getByRole('button', { name: 'Подтвердить номер', exact: true }).click()
    const otp = page.locator('input[autocomplete=one-time-code]'); await otp.waitFor()
    assert.equal(requests.find(r => r.url.endsWith('/start')).body.method, 'preferred')
    assert.equal(await phone.isDisabled(), true)
    await otp.pressSequentially('4826'); assert.equal(await otp.inputValue(), '4826'); assert.equal(await otp.evaluate(el => el === document.activeElement), true)
    await page.screenshot({ path: `${output}/${flow}-${width}-${theme}.png`, fullPage: true })
    await page.getByRole('button', { name: 'Подтвердить SMS-код', exact: true }).click()
    if (flow === 'profile') { await page.getByRole('button', { name: 'Сохранить номер', exact: true }).click(); await page.waitForFunction(() => !document.querySelector('#profile-change-phone-form')); assert.equal(requests.at(-1).body.callId, null) }
    else await page.locator('input[type=password]').first().waitFor()
    assert.equal(requests.filter(r => r.url.endsWith('/start') && !r.url.includes('/sms/')).length, 1)
    pass(`${flow} ${width}px ${theme}: preferred SMS без звонка, ввод без потери фокуса, подтверждение и ${flow === 'profile' ? 'сохранение номера' : 'переход к паролю'}`)
  }
  await page.goto(`${base}/register`); await page.getByRole('combobox').selectOption('krsk'); await page.locator('input[type=tel]').fill('79001234567'); await page.getByRole('button', { name: 'Подтвердить номер', exact: true }).click()
  await page.getByRole('button', { name: 'Подтвердить звонком', exact: true }).click(); await page.locator('a[href^="tel:"]').waitFor()
  assert.equal(requests.at(-1).body.method, 'call')
  await page.getByRole('button', { name: 'Не получилось позвонить — получить код по SMS', exact: true }).click(); await page.locator('input[autocomplete=one-time-code]').waitFor()
  pass('явный переход SMS → звонок → SMS')
  assert.deepEqual(errors, []); pass('нет pageerror React/JavaScript')
  await writeFile(`${output}/results.json`, JSON.stringify({ checks, errors, boundary: 'Реальные JSX/CSS. Сессии, API и кабинетная оболочка mocked; AuthSplitLayout и Modal настоящие. БД и настоящая отправка не выполнялись.' }, null, 2))
} finally { await browser.close() }
