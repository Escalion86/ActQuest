import test from 'node:test'
import assert from 'node:assert/strict'
import sanitize from '../helpers/sanitize.js'
import { normalizeComparableRichText } from '../components/modals/game-edit/sharedHelpers.js'
import { Editor, getSchema, Node } from '@tiptap/core'
import { EditorState, TextSelection } from '@tiptap/pm/state'
import { Fragment, Slice } from '@tiptap/pm/model'
import StarterKit from '@tiptap/starter-kit'

const richTabs = `<p>Общий текст</p><div class="aq-task-tabs" data-aq-tabs="true"><div class="aq-task-tabs__panels"><div class="aq-task-tabs__panel" data-aq-tab="true" data-aq-tab-title="Легенда"><p><strong>Код станции</strong></p></div><div class="aq-task-tabs__panel" data-aq-tab="true" data-aq-tab-title="Фото и аудио"><p>Ориентир</p><img src="https://example.com/station.jpg" alt="Вход"><audio-message src="https://example.com/clue.mp3" title="Подсказка"></audio-message><video-message src="https://example.com/clue.mp4" title="Запись"></video-message></div></div></div><p>Формат ответа: три цифры</p>`

test('сервер сохраняет структуру вкладок и их названия', () => {
  const html = sanitize(richTabs)
  assert.match(html, /data-aq-tabs="true"/)
  assert.equal((html.match(/data-aq-tab="true"/g) || []).length, 2)
  assert.match(html, /data-aq-tab-title="Легенда"/)
  assert.match(html, /data-aq-tab-title="Фото и аудио"/)
})

test('очистка вкладок сохраняет форматирование и все типы медиа', () => {
  const html = sanitize(richTabs)
  assert.match(html, /<strong>Код станции<\/strong>/)
  for (const url of ['station.jpg', 'clue.mp3', 'clue.mp4']) {
    assert.ok(html.includes(url), url)
  }
  assert.ok(html.startsWith('<p>Общий текст</p>'))
  assert.ok(html.endsWith('<p>Формат ответа: три цифры</p>'))
})

test('новые атрибуты вкладок не разрешают исполняемый HTML', () => {
  const html = sanitize('<div data-aq-tabs="true" onclick="alert(1)"><div class="aq-task-tabs__panels"><div data-aq-tab="true" data-aq-tab-title="&quot;&gt; &lt;script&gt;" onmouseover="alert(2)"><p>Текст</p><script>alert(3)</script><img src="javascript:alert(4)" onerror="alert(5)"></div></div></div>')
  assert.match(html, /data-aq-tabs="true"/)
  assert.match(html, /data-aq-tab-title="&quot;&gt; &lt;script&gt;"/)
  assert.doesNotMatch(html, /onclick|onmouseover|onerror|javascript:|<script>/i)
})

test('сравнение rich-text не удаляет блок вкладок как обычные обёртки', () => {
  assert.equal(normalizeComparableRichText(richTabs, 'Общий текст'), richTabs)
})

test('каждая вкладка является частью документа и сохраняет собственное форматирование', async () => {
  const { TaskTabs, TaskTab } = await import('../components/cabinet/task-rich-editor/taskTabsExtension.js')
  const { createTaskTabsContent } = await import('../helpers/taskRichTabs.js')
  const schema = getSchema([StarterKit, TaskTabs, TaskTab])
  const content = createTaskTabsContent()
  content.content[0].content = [{ type: 'paragraph', content: [{ type: 'text', text: 'Код', marks: [{ type: 'bold' }] }] }]
  content.content[1].content = [{ type: 'paragraph', content: [{ type: 'text', text: 'Фото станции' }] }]
  const node = schema.nodeFromJSON(content)
  node.check()
  assert.equal(node.type.name, 'taskTabs')
  assert.equal(node.childCount, 2)
  assert.equal(node.child(0).child(0).child(0).marks[0].type.name, 'bold')
  assert.equal(node.child(1).textContent, 'Фото станции')
  assert.deepEqual(schema.nodeFromJSON(node.toJSON()).toJSON(), node.toJSON())
})

test('пустое и длинное название вкладки нормализуются без повреждения Unicode', async () => {
  const { normalizeTaskTabTitle } = await import('../helpers/taskRichTabs.js')
  assert.equal(normalizeTaskTabTitle('   '), 'Вкладка')
  assert.equal(normalizeTaskTabTitle('  Фото\n  станции '), 'Фото станции')
  assert.equal(Array.from(normalizeTaskTabTitle('🚗'.repeat(45))).length, 40)
})

test('вставка вкладок сохраняет текст по обе стороны курсора и выбирает первую вкладку', async () => {
  const { TaskTabs, TaskTab } = await import('../components/cabinet/task-rich-editor/taskTabsExtension.js')
  const editor = new Editor({ element: null, extensions: [StarterKit, TaskTabs, TaskTab], content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'НачалоКонец' }] }] } })
  editor.commands.setTextSelection(7)
  assert.equal(editor.commands.insertTaskTabs(), true)
  assert.equal(editor.state.doc.child(0).textContent, 'Начало')
  assert.equal(editor.state.doc.child(1).type.name, 'taskTabs')
  assert.equal(editor.state.doc.child(2).textContent, 'Конец')
  assert.equal(editor.state.selection.$from.node(-1).attrs.title, 'Вкладка 1')
  const json = editor.getJSON()
  assert.equal(editor.commands.insertTaskTabs(), false)
  assert.deepEqual(editor.getJSON(), json)
  editor.destroy()
})

test('вкладка только с медиа получает текстовую позицию без удаления файла', async () => {
  const { TaskTabs, TaskTab } = await import('../components/cabinet/task-rich-editor/taskTabsExtension.js')
  assert.equal(typeof TaskTabs.config.addProseMirrorPlugins, 'function')
  const media = Node.create({ name: 'testMedia', group: 'block', atom: true })
  const schema = getSchema([StarterKit, media, TaskTabs, TaskTab])
  const doc = schema.nodeFromJSON({ type: 'doc', content: [
    { type: 'taskTabs', content: [{ type: 'taskTab', attrs: { title: 'Медиа' }, content: [{ type: 'testMedia' }] }] },
    { type: 'paragraph' },
  ] })
  const state = EditorState.create({ schema, doc, plugins: TaskTabs.config.addProseMirrorPlugins() })
  const result = state.applyTransaction(state.tr.insertText('Общий текст', doc.content.size - 1)).state
  const panel = result.doc.child(0).child(0)
  assert.equal(panel.child(0).type.name, 'testMedia')
  assert.equal(panel.lastChild.type.name, 'paragraph')
})

test('все стили вкладок сохраняются после серверной очистки и сравнения rich-text', async () => {
  const { TASK_TABS_STYLES } = await import('../helpers/taskRichTabs.js')
  for (const { value } of TASK_TABS_STYLES) {
    const source = richTabs.replace('data-aq-tabs="true"', `data-aq-tabs="true" data-aq-tabs-style="${value}"`)
    const html = sanitize(source)
    assert.match(html, new RegExp(`data-aq-tabs-style="${value}"`))
    assert.equal(normalizeComparableRichText(html, ''), html)
    assert.match(html, /<strong>Код станции<\/strong>/)
    assert.match(html, /clue\.mp4/)
  }
})

test('старые вкладки и неизвестный стиль используют обычное оформление', async () => {
  const { normalizeTaskTabsStyle } = await import('../helpers/taskRichTabs.js')
  const { TaskTabs, TaskTab } = await import('../components/cabinet/task-rich-editor/taskTabsExtension.js')
  const schema = getSchema([StarterKit, TaskTabs, TaskTab])
  assert.equal(schema.nodeFromJSON({ type: 'taskTabs', content: [{ type: 'taskTab', content: [{ type: 'paragraph' }] }] }).attrs.style, 'tabs')
  for (const value of [undefined, null, '', 'unknown', 'CARDS', 'url(javascript:alert(1))']) {
    assert.equal(normalizeTaskTabsStyle(value), 'tabs')
  }
})

test('смена стиля меняет только выбранный блок и сохраняет содержимое всех вкладок', async () => {
  const { TaskTabs, TaskTab } = await import('../components/cabinet/task-rich-editor/taskTabsExtension.js')
  const { createTaskTabsContent } = await import('../helpers/taskRichTabs.js')
  const block = createTaskTabsContent()
  block.content[0].content[0].content = [{ type: 'text', text: 'Материалы', marks: [{ type: 'bold' }] }]
  const editor = new Editor({ element: null, extensions: [StarterKit, TaskTabs, TaskTab], content: { type: 'doc', content: [block, block] } })
  const originalContent = editor.getJSON().content[0].content
  const secondPosition = editor.state.doc.child(0).nodeSize
  for (const style of ['cards', 'accordion', 'map', 'tabs']) {
    assert.equal(editor.commands.setTaskTabsStyle(style, secondPosition), true)
    assert.equal(editor.state.doc.child(0).attrs.style, 'tabs')
    assert.equal(editor.state.doc.child(1).attrs.style, style)
    assert.deepEqual(editor.getJSON().content[1].content, originalContent)
  }
  assert.equal(editor.commands.setTaskTabsStyle('unknown', secondPosition), true)
  assert.equal(editor.state.doc.child(1).attrs.style, 'tabs')
  assert.equal(editor.commands.setTaskTabsStyle('map', -1), false)
  editor.destroy()
})

test('удаление блока сохраняет соседний текст и оставляет доступную позицию курсора', async () => {
  const { TaskTabs, TaskTab } = await import('../components/cabinet/task-rich-editor/taskTabsExtension.js')
  const { createTaskTabsContent } = await import('../helpers/taskRichTabs.js')
  const paragraph = (text) => ({ type: 'paragraph', content: [{ type: 'text', text }] })
  const editor = new Editor({ element: null, extensions: [StarterKit, TaskTabs, TaskTab], content: { type: 'doc', content: [paragraph('До'), createTaskTabsContent(), paragraph('После')] } })
  editor.commands.setTextSelection(7)
  assert.equal(editor.commands.deleteTaskTabs(), true)
  assert.deepEqual(editor.getJSON().content, [paragraph('До'), paragraph('После')])
  assert.equal(editor.state.selection.$from.parent.isTextblock, true)
  assert.equal(editor.commands.deleteTaskTabs(), false)
  editor.commands.setContent({ type: 'doc', content: [createTaskTabsContent()] })
  assert.equal(editor.commands.deleteTaskTabs(0), true)
  assert.equal(editor.state.doc.childCount, 1)
  assert.equal(editor.state.doc.firstChild.type.name, 'paragraph')
  editor.destroy()
})

const createTabsPasteState = async (extraExtensions = []) => {
  const { TaskTabs, TaskTab } = await import('../components/cabinet/task-rich-editor/taskTabsExtension.js')
  const { createTaskTabsContent } = await import('../helpers/taskRichTabs.js')
  const schema = getSchema([StarterKit, ...extraExtensions, TaskTabs, TaskTab])
  const block = createTaskTabsContent()
  block.content[0].content[0].content = [{ type: 'text', text: 'Исходная строка' }]
  block.content[1].content[0].content = [{ type: 'text', text: 'Место вставки' }]
  const doc = schema.nodeFromJSON({ type: 'doc', content: [block, { type: 'paragraph' }] })
  const secondTab = 1 + doc.firstChild.firstChild.nodeSize
  const state = EditorState.create({ schema, doc, selection: TextSelection.create(doc, secondTab + 2), plugins: TaskTabs.config.addProseMirrorPlugins() })
  const transformPasted = (slice, targetState = state) => state.plugins.reduce(
    (result, plugin) => plugin.props.transformPasted?.(result, { state: targetState }) ?? result,
    slice,
  )
  return { schema, state, transformPasted }
}

test('вставка блока вкладок внутрь вкладки разворачивает содержимое с форматированием, списками и медиа', async () => {
  const media = Node.create({ name: 'testMedia', group: 'block', atom: true, addAttributes: () => ({ src: { default: '' } }) })
  const { schema, state, transformPasted } = await createTabsPasteState([media])
  const source = schema.nodeFromJSON({ type: 'taskTabs', attrs: { style: 'map' }, content: [
    { type: 'taskTab', attrs: { title: 'A' }, content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'Жирный текст', marks: [{ type: 'bold' }] }] },
      { type: 'testMedia', attrs: { src: 'https://example.com/clue.mp3' } },
    ] },
    { type: 'taskTab', attrs: { title: 'B' }, content: [
      { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Пункт списка' }] }] }] },
    ] },
  ] })
  const slice = transformPasted(new Slice(Fragment.from(source), 0, 0))
  assert.deepEqual(slice.content.toJSON(), [...source.child(0).content.toJSON(), ...source.child(1).content.toJSON()])
  const result = state.applyTransaction(state.tr.replaceSelection(slice)).state.doc
  result.check()
  let blocks = 0
  result.descendants((node) => { if (node.type.name === 'taskTabs') blocks += 1 })
  assert.equal(blocks, 1)
  assert.equal(result.firstChild.firstChild.textContent, 'Исходная строка')
  assert.match(result.firstChild.child(1).textContent, /Жирный текст.*Пункт списка/)
})

test('вставка строки из служебного контекста буфера сохраняет открытые границы абзаца', async () => {
  const { schema, transformPasted } = await createTabsPasteState()
  const paragraph = schema.nodes.paragraph.create(null, schema.text('Фрагмент строки', [schema.marks.bold.create()]))
  const panel = schema.nodes.taskTab.create({ title: 'A' }, paragraph)
  const content = Fragment.from(schema.nodes.taskTabs.create(null, panel))
  for (const [openStart, openEnd] of [[3, 3], [2, 2], [3, 2], [2, 3]]) {
    const slice = transformPasted(new Slice(content, openStart, openEnd))
    assert.deepEqual(slice.content.toJSON(), [paragraph.toJSON()])
    assert.equal(slice.openStart, openStart - 2)
    assert.equal(slice.openEnd, openEnd - 2)
  }
  const panelSlice = transformPasted(new Slice(Fragment.from(panel), 2, 2))
  assert.equal(panelSlice.openStart, 1)
  assert.equal(panelSlice.openEnd, 1)
  assert.deepEqual(panelSlice.content.toJSON(), [paragraph.toJSON()])
})

test('вставка разворачивает вложенные вкладки внутри цитаты, сохраняя саму цитату', async () => {
  const { schema, transformPasted } = await createTabsPasteState()
  const paragraph = schema.nodes.paragraph.create(null, schema.text('Вложенный материал'))
  const inner = schema.nodes.taskTabs.create(null, schema.nodes.taskTab.create(null, paragraph))
  const quote = schema.nodes.blockquote.create(null, inner)
  const outer = schema.nodes.taskTabs.create(null, schema.nodes.taskTab.create(null, quote))
  const slice = transformPasted(new Slice(Fragment.from(outer), 5, 5))
  assert.deepEqual(slice.content.toJSON(), [schema.nodes.blockquote.create(null, paragraph).toJSON()])
  assert.equal(slice.openStart, 1)
  assert.equal(slice.openEnd, 1)
})

test('обычный текст внутри вкладки и целый блок снаружи вкладок вставляются без преобразования', async () => {
  const { state, schema, transformPasted } = await createTabsPasteState()
  const text = new Slice(Fragment.from(schema.nodes.paragraph.create(null, schema.text('Обычная строка'))), 1, 1)
  assert.equal(transformPasted(text), text)
  const block = new Slice(Fragment.from(state.doc.firstChild), 0, 0)
  const outside = state.apply(state.tr.setSelection(TextSelection.atEnd(state.doc)))
  assert.equal(transformPasted(block, outside), block)
})
