// Регрессия на DOM настоящего CabinetLayout; права заданы явными фикстурами.
import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { startHarness, launchBrowser, openFixture, target, label, output } from './miniSitesNavigation.browser.mjs'
let harness, browser
before(async()=>{harness=await startHarness();browser=await launchBrowser()})
after(async()=>{await browser?.close();await harness?.close()})
for (const role of ['dev','admin']) {
  test(`${role}: настоящий DOM содержит единственную активную ссылку мини-сайтов`,async()=>{
    const {context,page,errors}=await openFixture(browser,harness.base,{role})
    try {
      // Контроль среды: настоящий кабинет, группа и соседний пункт уже отрисованы.
      assert.equal(await page.getByRole('button',{name:'Администрирование',exact:true}).count(),1)
      assert.equal(await page.getByRole('link',{name:'Отзывы об играх',exact:true}).count(),1)
      assert.deepEqual(errors,[])
      const link=page.getByRole('link',{name:label,exact:true})
      await writeFile(path.join(output,`regression-${role}.html`),await page.content())
      await page.screenshot({path:path.join(output,`regression-${role}.png`),fullPage:true})
      assert.equal(await link.count(),1,`Роль ${role}: в DOM отсутствует единственная ссылка «${label}»`)
      assert.equal(await link.isVisible(),true)
      assert.equal(await link.getAttribute('href'),target)
      assert.match(await link.getAttribute('class'),/bg-cyan-100\/70/)
    } finally {await context.close()}
  })
  test(`${role}: ссылка не подсвечена на другом маршруте`,async()=>{
    const {context,page,errors}=await openFixture(browser,harness.base,{role,route:'/cabinet/profile'})
    try {
      await page.getByRole('button',{name:'Администрирование',exact:true}).click()
      const link=page.getByRole('link',{name:label,exact:true})
      assert.equal(await link.count(),1,`Роль ${role}: отсутствует ссылка в раскрытой группе`)
      assert.doesNotMatch(await link.getAttribute('class'),/bg-cyan-100\/70/)
      assert.deepEqual(errors,[])
    } finally {await context.close()}
  })
}
for (const role of ['client','agent','moder','ban']) {
  test(`${role}: административной группы и ссылки нет в DOM`,async()=>{
    const {context,page,errors}=await openFixture(browser,harness.base,{role})
    try {
      assert.equal(await page.getByRole('link',{name:'Мой профиль',exact:true}).count(),1)
      assert.equal(await page.getByRole('button',{name:'Администрирование',exact:true}).count(),0)
      assert.equal(await page.locator(`a[href="${target}"]`).count(),0)
      assert.equal(await page.getByText(label,{exact:true}).count(),0)
      assert.deepEqual(errors,[])
    } finally {await context.close()}
  })
}
