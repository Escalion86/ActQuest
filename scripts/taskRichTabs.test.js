import test from 'node:test'
import assert from 'node:assert/strict'
import sanitize from '../helpers/sanitize.js'
import { normalizeComparableRichText } from '../components/modals/game-edit/sharedHelpers.js'
import { Editor, getSchema, Node } from '@tiptap/core'
import { EditorState } from '@tiptap/pm/state'
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
