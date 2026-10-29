import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
const output = process.env.COPY_TASKS_QA_OUTPUT
if (!output) throw new Error('Укажите COPY_TASKS_QA_OUTPUT в scratch')
const specifier = process.env.COPY_TASKS_PLAYWRIGHT_MODULE || 'playwright'
const { chromium } = await import(specifier.startsWith('/') ? pathToFileURL(specifier).href : specifier)
const browser = await chromium.launch({ headless: true, ...(process.env.COPY_TASKS_CHROMIUM_PATH ? { executablePath: process.env.COPY_TASKS_CHROMIUM_PATH } : {}), args: ['--no-sandbox','--disable-dev-shm-usage','--no-zygote','--single-process','--disable-gpu'] })
const base = process.env.COPY_TASKS_QA_BASE || 'http://127.0.0.1:3295', checks = [], errors = [], consoleErrors = []
const pass = message => { checks.push(message); console.log('PASS '+message) }
try {
  const page = await browser.newPage()
  page.on('pageerror',err => errors.push(err.message))
  page.on('console',message => { if (message.type() === 'error' && !message.text().includes('status of 409') && !message.text().includes('status of 500')) consoleErrors.push(message.text()) })
  await page.route('**/*',route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort())
  let failLoad = false, failCopy = false, failSave = false, holdCopy = false, releaseCopy, empty = false, requests = [], saves = 0
  const targetId = '222222222222222222222222'
  await page.route('**/api/cabinet/games/*/copy-tasks',async route => {
    if (route.request().method() === 'GET') return route.fulfill({status:failLoad ? 500 : 200,json:failLoad ? {success:false,error:'Ошибка загрузки'} : {success:true,data:{tasks:empty ? [] : [{id:'aaaaaaaaaaaaaaaaaaaaaaaa',title:'Первое задание'},{id:'ffffffffffffffffffffffff',title:'Второе задание'},{id:'777777777777777777777777',title:'Этап с предметами',blockedReason:'Варианты и предметы связаны с другими этапами.'}],targets:empty ? [] : [{id:targetId,name:'Игра назначения',type:'classic',status:'active'}]}}})
    requests.push(route.request().postDataJSON())
    if (holdCopy) await new Promise(resolve => { releaseCopy = resolve })
    return route.fulfill({status:failCopy ? 409 : 200,json:failCopy ? {success:false,error:'Сервер отказал: игра уже запущена'} : {success:true,data:{targetGameId:targetId,count:2}}})
  })
  await page.route('**/fixture-save',route => { saves++; return route.fulfill({status:failSave ? 500 : 200,json:{success:!failSave}}) })
  await page.route('**/fixture-target',route => route.fulfill({json:{success:true}}))
  const settings = async path => { await page.goto(base+path); assert.match(await page.title(),/ActQuest/); await page.getByRole('button',{name:'Открыть настройки',exact:true}).click(); await page.getByRole('button',{name:'Скопировать задания в другую игру',exact:true}).click() }
  const next = () => page.getByRole('button',{name:'Выбрать игру, куда копировать',exact:true})
  const choose = async () => { await page.getByLabel('Выбрать все',{exact:true}).check(); await next().click(); assert.equal(await page.getByRole('button',{name:'Продолжить',exact:true}).isDisabled(),true); await page.getByRole('radio',{name:'Игра назначения',exact:true}).check(); await page.getByRole('button',{name:'Продолжить',exact:true}).click() }
  for (const width of [390,1440]) for (const theme of ['light','dark']) {
    requests = []; await page.setViewportSize({width,height:900}); await settings('/closed'); await page.evaluate(theme => { document.documentElement.className = theme === 'dark' ? 'dark' : ''; document.documentElement.dataset.theme = theme },theme)
    await next().waitFor(); assert.equal(await next().isDisabled(),true); assert.equal(await page.getByLabel('3. Этап с предметами',{exact:false}).isDisabled(),true)
    const one = page.getByLabel('1. Первое задание',{exact:true}); await one.check(); assert.equal(await next().isDisabled(),false); await one.uncheck(); assert.equal(await next().isDisabled(),true)
    await page.getByRole('button',{name:'Отмена',exact:true}).click(); assert.equal(requests.length,0); await page.getByRole('button',{name:'Скопировать задания в другую игру',exact:true}).click(); await next().waitFor()
    await choose(); await page.getByRole('button',{name:'Назад',exact:true}).click(); await page.getByRole('button',{name:'Назад',exact:true}).click(); assert.equal(await one.isChecked(),true); await next().click(); await page.getByRole('button',{name:'Продолжить',exact:true}).click()
    await page.screenshot({path:output+'/confirm-'+width+'-'+theme+'.png',fullPage:true}); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),true)
    failCopy = true; await page.getByRole('button',{name:'Скопировать',exact:true}).click(); await page.getByRole('alert').waitFor(); assert.equal(await page.getByRole('button',{name:'Открыть задания целевой игры',exact:true}).count(),0)
    const key = requests[0].requestId; failCopy = false; holdCopy = true; releaseCopy = undefined
    await page.getByRole('button',{name:'Скопировать',exact:true}).dblclick({delay:20}); await page.waitForFunction(() => document.querySelector('[aria-busy="true"]')); assert.equal(await page.getByRole('button',{name:'Скопировать',exact:true}).isDisabled(),true)
    for (let i=0; !releaseCopy && i<100; i++) await new Promise(resolve => setTimeout(resolve,10))
    assert.ok(releaseCopy); holdCopy = false; releaseCopy(); await page.getByRole('button',{name:'Открыть задания целевой игры',exact:true}).waitFor(); assert.equal(requests.length,2); assert.equal(requests[1].requestId,key)
    await page.screenshot({path:output+'/success-'+width+'-'+theme+'.png',fullPage:true}); await page.getByRole('button',{name:'Открыть задания целевой игры',exact:true}).click(); await page.getByText('Открыты задания: '+targetId,{exact:true}).waitFor(); await page.getByRole('dialog',{name:'Редактор заданий «Игра назначения»',exact:true}).waitFor()
    pass(width+'px '+theme+': закрытый источник → настройки → выбор/все/отмена → назначение/назад → подтверждение → отказ → ожидание/двойной клик → успех → редактор цели')
  }
  await settings('/dirty'); await page.getByText('Есть несохранённые изменения.',{exact:false}).waitFor(); failSave = true; await page.getByRole('button',{name:'Сохранить и продолжить',exact:true}).click(); await page.getByRole('alert').waitFor(); assert.equal(await next().count(),0); failSave = false; await page.getByRole('button',{name:'Сохранить и продолжить',exact:true}).click(); await next().waitFor(); assert.equal(saves,2); pass('dirty: явное сохранение, ошибка блокирует переход, успешное сохранение открывает выбор')
  failLoad = true; await settings('/'); await page.getByRole('alert').waitFor(); failLoad = false; await page.getByRole('button',{name:'Повторить загрузку',exact:true}).click(); await next().waitFor(); pass('ошибка GET и повтор загрузки')
  empty = true; await settings('/'); await page.getByText('В исходной игре нет сохранённых заданий.',{exact:true}).waitFor(); assert.equal(await next().isDisabled(),true); empty = false; pass('пустой источник блокирует следующий шаг')
  await page.goto(base+'/story'); await page.getByRole('button',{name:'Открыть настройки',exact:true}).click(); assert.equal(await page.getByRole('button',{name:'Скопировать задания в другую игру',exact:true}).count(),0); pass('story: кнопка копирования tasks отсутствует')
  assert.deepEqual(errors,[]); assert.deepEqual(consoleErrors,[]); assert.equal(await page.locator('nextjs-portal').count(),0); pass('нет pageerror, неожиданных console.error и framework overlay; страницы содержат настоящий JSX')
  await writeFile(output+'/results.json',JSON.stringify({checks,errors,consoleErrors,boundary:'Изолированный localhost-стенд, настоящий JSX редактора/настроек/копирования, Modal, CabinetButton и CSS. API и тяжёлые дочерние редакторы mocked. Внешняя БД и авторизованный production не используются.',browser:'Browser plugin not available; Playwright Chromium'},null,2))
} finally { await browser.close() }
