import { canManageClassicEditor, showClassicItemsAndVariants } from '../helpers/classicEditorSettings.js'
import normalizeGameForCabinet from '../helpers/normalizeGameForCabinet.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import { classicEditorContent, copyClassicContent, updateClassicEditorContent, changeClassicEditorCode, normalizeClassicItemQuantities, explainClassicVariant, classicItemUsage } from '../helpers/classicVariantEditor.js'
import { getClassicVariantChoices } from '../helpers/classicVariants.js'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// Проверяем реальный JSX-компонент на значениях, приходящих из старых игр.
const loadRewardComponents = async () => {
  const filename = fileURLToPath(new URL('../components/modals/game-tasks/ClassicItemQuantities.js', import.meta.url))
  const require = createRequire(filename)
  const swc = require('next/dist/build/swc')
  await swc.loadBindings()
  const { code } = await swc.transform(await readFile(filename, 'utf8'), {
    filename,
    jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } } },
    module: { type: 'commonjs' },
  })
  const modalFilename = fileURLToPath(new URL('../components/Modal.js', import.meta.url))
  const { code: modalCode } = await swc.transform(await readFile(modalFilename, 'utf8'), {
    filename: modalFilename,
    jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } } },
    module: { type: 'commonjs' },
  })
  const modalModule = { exports: {} }
  new Function('require', 'module', 'exports', modalCode)(require, modalModule, modalModule.exports)
  const module = { exports: {} }
  const componentRequire = (id) => id === '@components/Modal' ? modalModule.exports : require(id)
  new Function('require', 'module', 'exports', code)(componentRequire, module, module.exports)
  return module.exports
}

test('формы наград отображают null из старых игр и сохраняют заполненные награды', async () => {
  const { default: Quantities, ClassicOutcomeRewards } = await loadRewardComponents()
  const items = [{ id: 'key', title: 'Ключ', kind: 'unique' }]
  const props = { items, onChange: () => {} }
  for (const value of [undefined, null, {}, { completed: null, timeout: null, captain_failed: null }]) {
    const html = renderToStaticMarkup(createElement(ClassicOutcomeRewards, { ...props, value }))
    assert.match(html, /За выполнение/)
    assert.match(html, /Если время истекло/)
    assert.match(html, /Добавить предмет/)
  }
  for (const value of [undefined, null, []]) {
    assert.match(renderToStaticMarkup(createElement(Quantities, { ...props, value })), /Добавить предмет/)
  }
  const value = { completed: [{ itemId: 'key', quantity: 1 }], timeout: null }
  assert.match(renderToStaticMarkup(createElement(ClassicOutcomeRewards, { ...props, value })), /Ключ ×1/)
})

const fixture = () => ({ type: 'classic', classicItems: [{ id: 'key', title: 'Ключ', kind: 'unique' }], tasks: [
  { id: 'a', stageKey: 'stage-a', title: 'Склад', codes: ['МАЯК'], itemRewards: { codes: [{ category: 'main', code: 'МАЯК', items: [{ itemId: 'key', quantity: 1 }] }] } },
  { id: 'b', title: 'Переход', codes: ['ОБХОД'], variantConfig: { enabled: true, mode: 'auto' }, variants: [{
    id: 'tunnel', title: 'Тоннель',
    conditions: { mode: 'all', rules: [{ type: 'code', stageId: 'stage-a', variantId: 'default', category: 'main', code: 'МАЯК' }] },
    consumeItems: [{ itemId: 'key', quantity: 1 }],
    content: { title: 'Тоннель', codes: ['ВХОД'], clues: [{ clue: 'Подсказка' }], bonusCodes: [{ code: 'БОНУС', bonus: 10 }],
      itemRewards: { codes: [{ category: 'bonus', code: 'БОНУС', items: [{ itemId: 'key', quantity: 1 }] }] },
    },
  }] },
] })

test('редактирование старой альтернативы сохраняет основной путь и даёт стабильные ID подсказкам', () => {
  const game = fixture()
  const original = structuredClone(game)
  const view = classicEditorContent(game.tasks[1].variants[0].content, 'tunnel')
  const next = updateClassicEditorContent(game, 'b', 'tunnel', (content) => ({ clues: content.clues.map((clue) => clue.id === view.clues[0].id ? { ...clue, clue: 'Новая подсказка' } : clue) }))
  assert.deepEqual(game, original)
  assert.deepEqual(next.tasks[1].codes, ['ОБХОД'])
  assert.equal(next.tasks[1].variants[0].content.clues[0].clue, 'Новая подсказка')
  assert.equal(classicEditorContent(next.tasks[1].variants[0].content, 'tunnel').clues[0].id, view.clues[0].id)
})

test('переименование основного кода переносит награду и условие следующего этапа', () => {
  const game = fixture()
  const next = changeClassicEditorCode(game, 'a', 'default', 'main', 0, 'СИГНАЛ')
  assert.equal(next.tasks[0].itemRewards.codes[0].code, 'СИГНАЛ')
  assert.equal(next.tasks[1].variants[0].conditions.rules[0].code, 'СИГНАЛ')
  assert.equal(game.tasks[0].codes[0], 'МАЯК')
})

test('очистка поля и последующий ввод кода сохраняют связанные награды и условия', () => {
  const cleared = changeClassicEditorCode(fixture(), 'a', 'default', 'main', 0, '')
  const typed = changeClassicEditorCode(cleared, 'a', 'default', 'main', 0, 'НОВЫЙ')
  assert.equal(typed.tasks[0].itemRewards.codes[0].code, 'НОВЫЙ')
  assert.equal(typed.tasks[1].variants[0].conditions.rules[0].code, 'НОВЫЙ')
})

test('переименование и удаление бонусного кода альтернативы не меняет другие варианты', () => {
  const game = fixture()
  const id = classicEditorContent(game.tasks[1].variants[0].content, 'tunnel').bonusCodes[0].id
  const next = changeClassicEditorCode(game, 'b', 'tunnel', 'bonus', id, 'НОВЫЙ')
  assert.equal(next.tasks[1].variants[0].content.bonusCodes[0].code, 'НОВЫЙ')
  assert.equal(next.tasks[1].variants[0].content.itemRewards.codes[0].code, 'НОВЫЙ')
  const removed = changeClassicEditorCode(next, 'b', 'tunnel', 'bonus', id, '', true)
  assert.deepEqual(removed.tasks[1].variants[0].content.itemRewards.codes, [])
  assert.deepEqual(removed.tasks[1].codes, ['ОБХОД'])
})

test('копия переносит содержимое и награды, но не общие награды и вложенные варианты', () => {
  const source = { ...fixture().tasks[1], canceled: true, outcomeRewards: { timeout: [{ itemId: 'key', quantity: 1 }] } }
  const copy = copyClassicContent(source)
  assert.equal(copy.variants, undefined)
  assert.equal(copy.outcomeRewards, undefined)
  assert.equal(copy.canceled, undefined)
  copy.codes[0] = 'ДРУГОЙ'
  assert.equal(source.codes[0], 'ОБХОД')
})

test('смена типа предмета нормализует условия, расход и награды, сохраняя накапливаемые предметы', () => {
  const source = [{ conditions: { rules: [{ itemId: 'key', quantity: 4 }] }, consumeItems: [{ itemId: 'key', quantity: 3 }], itemRewards: { completed: [{ itemId: 'coin', quantity: 5 }] } }]
  const next = normalizeClassicItemQuantities(source, [{ id: 'key', kind: 'unique' }])
  assert.equal(next[0].conditions.rules[0].quantity, 1)
  assert.equal(next[0].consumeItems[0].quantity, 1)
  assert.equal(next[0].itemRewards.completed[0].quantity, 5)
  assert.equal(source[0].consumeItems[0].quantity, 3)
})

test('объяснение доступности совпадает с движком: любое условие не отменяет расход', () => {
  const game = fixture()
  const variant = game.tasks[1].variants[0]
  variant.conditions = { mode: 'any', rules: [{ type: 'item', itemId: 'key', quantity: 1 }, { type: 'item', itemId: 'missing', quantity: 1, absent: true }] }
  const team = { classicProgress: { inventory: [] } }
  assert.equal(getClassicVariantChoices(game, team, 1)[0].id, 'default')
  assert.match(explainClassicVariant(game, team, 1, variant).join(), /Для расхода/)
  team.classicProgress.inventory = [{ itemId: 'key', quantity: 1 }]
  assert.deepEqual(explainClassicVariant(game, team, 1, variant), [])
  assert.equal(getClassicVariantChoices(game, team, 1)[0].id, 'tunnel')
})

test('каталог показывает выдачу и использование в том числе в выключенных вариантах', () => {
  const game = fixture()
  game.tasks[1].variantConfig.enabled = false
  const usage = classicItemUsage(game.tasks, 'key')
  assert.equal(usage.grants.length, 2)
  assert.equal(usage.uses.length, 1)
})

test('настройки предметов доступны администратору и разработчику', () => {
  assert.equal(canManageClassicEditor('admin'), true)
  assert.equal(canManageClassicEditor('dev'), true)
  for (const role of ['moderator', 'user', undefined]) assert.equal(canManageClassicEditor(role), false)
})

test('новая настройка редактора скрыта по умолчанию и сохраняется при нормализации', () => {
  const game = { type: 'classic', tasks: [], classicItems: [] }
  assert.equal(showClassicItemsAndVariants(game), false)
  for (const enabled of [true, false]) {
    const normalized = normalizeGameForCabinet({ ...game, classicItemsAndVariantsEnabled: enabled })
    assert.equal(normalized.classicItemsAndVariantsEnabled, enabled)
    assert.equal(showClassicItemsAndVariants(normalized), enabled)
  }
  assert.equal(showClassicItemsAndVariants({ ...game, type: 'photo', classicItemsAndVariantsEnabled: true }), false)
})

test('старые игры сохраняют доступ к механике, отключение интерфейса не удаляет правила', () => {
  const game = fixture()
  const original = structuredClone(game)
  assert.equal(showClassicItemsAndVariants(game), true)
  assert.equal(normalizeGameForCabinet(game).classicItemsAndVariantsEnabled, true)
  assert.equal(showClassicItemsAndVariants({ type: 'classic', tasks: [{ variants: [{ id: 'saved' }], variantConfig: { enabled: false } }] }), true)
  const hidden = { ...game, classicItemsAndVariantsEnabled: false }
  assert.equal(showClassicItemsAndVariants(hidden), false)
  assert.equal(normalizeGameForCabinet(hidden).classicItemsAndVariantsEnabled, false)
  assert.deepEqual(hidden.tasks, original.tasks)
  assert.deepEqual(hidden.classicItems, original.classicItems)
  assert.deepEqual(getClassicVariantChoices(hidden, {}, 1), getClassicVariantChoices(game, {}, 1))
})
