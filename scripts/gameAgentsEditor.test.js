import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// Загружаем настоящий JSX и его компоненты без подмены интерфейса.
const root = new URL('../', import.meta.url)
const require = createRequire(import.meta.url)
const swc = require('next/dist/build/swc')
await swc.loadBindings()
const modules = new Map()
const loadComponent = async (relativePath) => {
  const filename = fileURLToPath(new URL(relativePath, root))
  if (modules.has(filename)) return modules.get(filename)
  const source = await readFile(filename, 'utf8')
  const aliases = new Map()
  for (const match of source.matchAll(/from ['"](@components\/[^'"]+)['"]/g)) {
    aliases.set(match[1], await loadComponent(`${match[1].replace('@components/', 'components/')}.js`))
  }
  const { code } = await swc.transform(source, {
    filename,
    jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } } },
    module: { type: 'commonjs' },
  })
  const module = { exports: {} }
  new Function('require', 'module', 'exports', code)(
    (id) => aliases.has(id) ? aliases.get(id) : require(id), module, module.exports,
  )
  modules.set(filename, module.exports)
  return module.exports
}
const { default: Section } = await loadComponent('components/modals/game-edit/sections/GameModeratorsSection.js')
const noop = () => {}
const agent = { userId: 'agent-1', name: 'Тестовый агент' }
const props = (overrides = {}) => ({
  selectedGame: {}, selectedGameModerators: [], canEditSelectedGame: true,
  availableModeratorsForSelect: [], availableModeratorsMap: new Map(),
  selectedModeratorToAdd: '', setSelectedModeratorToAdd: noop,
  handleAddModerator: noop, handleRemoveModerator: noop,
  selectedGameAgents: [], isSaving: false, availableAgentsForSelect: [],
  availableAgentsMap: new Map(), selectedAgentToAdd: '',
  setSelectedAgentToAdd: noop, handleAddAgent: noop, handleRemoveAgent: noop,
  updateSelectedGame: noop, getCheckboxChecked: (event) => event.target.checked,
  ...overrides,
})
const inputs = (html) => [...html.matchAll(/<input\b[^>]*>/g)].map((match) => match[0])
const nodes = (node) => {
  if (!node || typeof node !== 'object') return []
  return [node, ...[node.props?.children].flat(Infinity).flatMap(nodes)]
}

test('игра без агентов открывает настройки без блока уведомлений', () => {
  const html = renderToStaticMarkup(createElement(Section, props()))
  assert.match(html, /Агенты пока не назначены/)
  assert.equal(inputs(html).length, 0)
})

test('добавление первого агента отображает четыре настройки уведомлений без ошибки', () => {
  const html = renderToStaticMarkup(createElement(Section, props({ selectedGameAgents: [agent] })))
  assert.match(html, /Тестовый агент/)
  const checkboxes = inputs(html)
  assert.equal(checkboxes.length, 4)
  assert.deepEqual(checkboxes.map((input) => input.includes('checked=""')), [true, true, false, true])
})

test('настройки уведомлений берутся из выбранной игры', () => {
  const html = renderToStaticMarkup(createElement(Section, props({
    selectedGameAgents: [agent],
    selectedGame: { agentNotifications: { onPreviousTask: false, onCurrentTask: false, onTaskCompleted: true, onAllTeamsPassed: false } },
  })))
  assert.deepEqual(inputs(html).map((input) => input.includes('checked=""')), [false, false, true, false])
})

test('изменение одного уведомления сохраняет остальные настройки', () => {
  let payload
  const notifications = { onPreviousTask: false, onCurrentTask: true, onTaskCompleted: true, onAllTeamsPassed: false }
  const tree = Section.type(props({
    selectedGameAgents: [agent], selectedGame: { agentNotifications: notifications },
    updateSelectedGame: (value) => { payload = value },
  }))
  const checkbox = nodes(tree).find((node) => node.props?.id === 'agent-notify-current-task')
  assert.ok(checkbox)
  checkbox.props.onChange({ target: { checked: false } })
  assert.deepEqual(payload, { agentNotifications: { ...notifications, onCurrentTask: false } })
})

test('редактор передаёт выбранную игру в секцию модераторов и агентов', async () => {
  const source = await readFile(new URL('components/modals/game-edit/GameEditModal.js', root), 'utf8')
  assert.match(source, /<GameModeratorsSection\s[^>]*selectedGame=\{selectedGame\}/)
})
