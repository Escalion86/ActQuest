import { getText, mergeAttributes, Node } from '@tiptap/core'
import { Plugin, TextSelection } from '@tiptap/pm/state'
import { closeHistory } from '@tiptap/pm/history'
import { DOMParser as ProseMirrorDOMParser, Fragment } from '@tiptap/pm/model'
import {
  createTaskTabsContent,
  MAX_TASK_TABS,
  MAX_TASK_TAB_TITLE_LENGTH,
  normalizeTaskTabTitle,
} from '../../../helpers/taskRichTabs.js'

let nextTabsViewId = 0
const TABS_HISTORY_ACTION = 'aq-task-tabs-action'
const tabAction = (tr) => closeHistory(tr).setMeta(TABS_HISTORY_ACTION, true)

const hasTextblock = (content) => {
  let found = false
  content.descendants((node) => {
    if (node.isTextblock) found = true
    return !found
  })
  return found
}

const panelSelection = (doc, position, panel) => {
  const start = doc.resolve(position + 1)
  const selection = TextSelection.findFrom(start, 1, true)
  return selection && selection.to < position + panel.nodeSize
    ? selection
    : TextSelection.near(start, 1)
}

const createTabsNodeView = ({ node: initialNode, editor, view, getPos }) => {
  const document = view.dom.ownerDocument
  const id = `aq-task-tabs-editor-${++nextTabsViewId}`
  let node = initialNode
  let activeIndex = 0
  let isDestroyed = false
  let settingsOpen = false
  let wasEditable = editor.isEditable

  const element = (tag, className, text) => {
    const dom = document.createElement(tag)
    if (className) dom.className = className
    if (text) dom.textContent = text
    return dom
  }
  const button = (text, onClick) => {
    const dom = element('button', 'aq-task-tabs__button', text)
    dom.type = 'button'
    dom.addEventListener('click', onClick)
    return dom
  }

  const dom = element('div', 'aq-task-tabs')
  dom.setAttribute('data-aq-tabs', 'true')
  dom.setAttribute('data-aq-tabs-ready', 'true')
  const tools = element('div', 'aq-task-tabs__editor-tools')
  tools.contentEditable = 'false'
  const caption = element('span', '', 'Блок вкладок')
  const settingsButton = button('Настроить', () => {
    settingsOpen = !settingsOpen
    renderControls()
    if (settingsOpen) titleInput.focus()
  })
  settingsButton.setAttribute('aria-controls', `${id}-settings`)
  tools.append(caption, settingsButton)

  const row = element('div', 'aq-task-tabs__tab-row')
  row.contentEditable = 'false'
  const tablist = element('div', 'aq-task-tabs__tablist')
  tablist.setAttribute('role', 'tablist')
  tablist.setAttribute('aria-label', 'Материалы задания')
  const addButton = button('+ Вкладка', () => changeTabs('add'))
  addButton.setAttribute('aria-label', 'Добавить вкладку')
  row.append(tablist, addButton)

  const settings = element('div', 'aq-task-tabs__settings')
  settings.id = `${id}-settings`
  settings.contentEditable = 'false'
  const titleLabel = element('label', '', 'Название выбранной вкладки')
  const titleInput = element('input')
  titleInput.id = `${id}-title`
  titleInput.type = 'text'
  titleInput.maxLength = MAX_TASK_TAB_TITLE_LENGTH * 2
  titleInput.autocomplete = 'off'
  titleLabel.htmlFor = titleInput.id
  const actions = element('div', 'aq-task-tabs__actions')
  const leftButton = button('Влево', () => changeTabs('left'))
  const rightButton = button('Вправо', () => changeTabs('right'))
  const duplicateButton = button('Копия', () => changeTabs('duplicate'))
  const deleteButton = button('Удалить', () => {
    confirmation.hidden = false
    confirmButton.focus()
  })
  deleteButton.classList.add('aq-task-tabs__button--danger')
  actions.append(leftButton, rightButton, duplicateButton, deleteButton)
  const confirmation = element('div', 'aq-task-tabs__actions')
  confirmation.hidden = true
  const confirmButton = button('Удалить вкладку', () => changeTabs('delete'))
  confirmButton.classList.add('aq-task-tabs__button--danger')
  const cancelButton = button('Отмена', () => {
    confirmation.hidden = true
    deleteButton.focus()
  })
  confirmation.append(element('span', '', 'Удалить вкладку вместе с содержимым?'), confirmButton, cancelButton)
  settings.append(titleLabel, titleInput, actions, confirmation)

  const contentDOM = element('div', 'aq-task-tabs__panels')
  const status = element('span', 'aq-task-tabs__status')
  status.contentEditable = 'false'
  status.setAttribute('role', 'status')
  status.setAttribute('aria-live', 'polite')
  dom.append(tools, row, settings, contentDOM, status)

  function currentBlock() {
    const position = getPos()
    if (typeof position !== 'number') return null
    const block = editor.state.doc.nodeAt(position)
    return block?.type.name === 'taskTabs' ? { block, position } : null
  }

  function panelPosition(block, position, index) {
    let offset = position + 1
    for (let i = 0; i < index; i += 1) offset += block.child(i).nodeSize
    return offset
  }

  function syncPanels() {
    if (isDestroyed) return
    const panels = Array.from(contentDOM.children).filter((child) => child.hasAttribute('data-aq-tab'))
    panels.forEach((panel, index) => {
      panel.id = `${id}-panel-${index}`
      panel.setAttribute('role', 'tabpanel')
      panel.setAttribute('aria-labelledby', `${id}-tab-${index}`)
      panel.hidden = index !== activeIndex
      if (panel.hidden) panel.querySelectorAll('audio, video').forEach((media) => media.pause())
    })
  }

  function renderControls() {
    if (isDestroyed) return
    const focusIndex = Array.from(tablist.children).indexOf(document.activeElement)
    activeIndex = Math.min(activeIndex, node.childCount - 1)
    tablist.replaceChildren()
    node.forEach((tab, _offset, index) => {
      const tabButton = button(normalizeTaskTabTitle(tab.attrs.title), () => selectTab(index))
      tabButton.className = 'aq-task-tabs__tab'
      tabButton.id = `${id}-tab-${index}`
      tabButton.setAttribute('role', 'tab')
      tabButton.setAttribute('aria-controls', `${id}-panel-${index}`)
      tabButton.setAttribute('aria-selected', String(index === activeIndex))
      tabButton.tabIndex = index === activeIndex ? 0 : -1
      tablist.append(tabButton)
    })
    if (focusIndex >= 0) tablist.children[Math.min(focusIndex, node.childCount - 1)]?.focus()
    tools.hidden = !editor.isEditable
    addButton.hidden = !editor.isEditable
    addButton.disabled = node.childCount >= MAX_TASK_TABS
    settings.hidden = !editor.isEditable || !settingsOpen
    settingsButton.setAttribute('aria-expanded', String(settingsOpen))
    if (document.activeElement !== titleInput) titleInput.value = normalizeTaskTabTitle(node.child(activeIndex).attrs.title)
    leftButton.disabled = activeIndex === 0
    rightButton.disabled = activeIndex === node.childCount - 1
    duplicateButton.disabled = node.childCount >= MAX_TASK_TABS
    deleteButton.disabled = node.childCount < 2
    syncPanels()
    queueMicrotask(syncPanels)
  }

  function selectTab(index, focusButton = false) {
    if (index < 0 || index >= node.childCount) return
    activeIndex = index
    confirmation.hidden = true
    renderControls()
    if (editor.isEditable) {
      const current = currentBlock()
      if (current) {
        const position = panelPosition(current.block, current.position, index)
        const selection = panelSelection(editor.state.doc, position, current.block.child(index))
        editor.view.dispatch(editor.state.tr.setSelection(selection))
        if (!focusButton) editor.view.focus()
      }
    }
    if (focusButton) tablist.children[index]?.focus()
  }

  function changeTabs(action) {
    if (!editor.isEditable) return
    const current = currentBlock()
    if (!current) return
    const tabs = []
    current.block.forEach((tab) => tabs.push(tab))
    let nextIndex = activeIndex
    if (action === 'add' || action === 'duplicate') {
      if (tabs.length >= MAX_TASK_TABS) return
      const newTab = action === 'duplicate'
        ? tabs[activeIndex].type.create({ title: normalizeTaskTabTitle(`${tabs[activeIndex].attrs.title} — копия`) }, tabs[activeIndex].content)
        : editor.schema.nodes.taskTab.create({ title: `Вкладка ${tabs.length + 1}` }, editor.schema.nodes.paragraph.create())
      nextIndex += 1
      tabs.splice(nextIndex, 0, newTab)
      settingsOpen = true
    } else if (action === 'delete') {
      if (tabs.length < 2) return
      tabs.splice(activeIndex, 1)
      nextIndex = Math.min(activeIndex, tabs.length - 1)
    } else {
      nextIndex += action === 'left' ? -1 : 1
      if (nextIndex < 0 || nextIndex >= tabs.length) return
      ;[tabs[activeIndex], tabs[nextIndex]] = [tabs[nextIndex], tabs[activeIndex]]
    }
    const nextBlock = current.block.type.create(current.block.attrs, tabs)
    const tr = editor.state.tr.replaceWith(current.position, current.position + current.block.nodeSize, nextBlock)
    const position = panelPosition(nextBlock, current.position, nextIndex)
    tr.setSelection(panelSelection(tr.doc, position, nextBlock.child(nextIndex)))
    activeIndex = nextIndex
    confirmation.hidden = true
    editor.view.dispatch(tabAction(tr).scrollIntoView())
    status.textContent = action === 'delete' ? 'Вкладка удалена. Действие можно отменить.' : action === 'left' || action === 'right' ? 'Порядок вкладок изменён.' : 'Вкладка добавлена.'
    if (action === 'add' || action === 'duplicate') {
      titleInput.value = normalizeTaskTabTitle(nextBlock.child(nextIndex).attrs.title)
      titleInput.focus()
      titleInput.select()
    } else editor.view.focus()
  }

  function renameTab() {
    if (!editor.isEditable) return
    const current = currentBlock()
    if (!current) return
    const title = normalizeTaskTabTitle(titleInput.value)
    titleInput.value = title
    if (title === current.block.child(activeIndex).attrs.title) return
    const position = panelPosition(current.block, current.position, activeIndex)
    editor.view.dispatch(tabAction(editor.state.tr.setNodeMarkup(position, undefined, { title })))
    status.textContent = 'Название вкладки изменено.'
  }

  titleInput.addEventListener('change', renameTab)
  titleInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      renameTab()
      selectTab(activeIndex)
    }
  })
  tablist.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const index = event.key === 'Home' ? 0 : event.key === 'End' ? node.childCount - 1 : (activeIndex + (event.key === 'ArrowRight' ? 1 : -1) + node.childCount) % node.childCount
    selectTab(index, true)
  })

  const followSelection = () => {
    if (!editor.isEditable || isDestroyed) return
    const current = currentBlock()
    if (!current) return
    const from = editor.state.selection.from
    let selectedIndex = -1
    current.block.forEach((tab, offset, index) => {
      const start = current.position + 1 + offset
      if (from > start && from < start + tab.nodeSize) selectedIndex = index
    })
    if (selectedIndex >= 0 && selectedIndex !== activeIndex) {
      activeIndex = selectedIndex
      confirmation.hidden = true
      renderControls()
    }
  }
  editor.on('selectionUpdate', followSelection)
  const syncEditable = () => {
    if (wasEditable === editor.isEditable) return
    wasEditable = editor.isEditable
    renderControls()
  }
  editor.on('transaction', syncEditable)
  renderControls()

  return {
    dom,
    contentDOM,
    update(nextNode) {
      if (nextNode.type !== node.type) return false
      node = nextNode
      renderControls()
      return true
    },
    stopEvent(event) {
      return tools.contains(event.target) || row.contains(event.target) || settings.contains(event.target)
    },
    ignoreMutation(mutation) {
      return mutation.type !== 'selection' && !contentDOM.contains(mutation.target)
    },
    destroy() {
      isDestroyed = true
      editor.off('selectionUpdate', followSelection)
      editor.off('transaction', syncEditable)
    },
  }
}

export const TaskTab = Node.create({
  name: 'taskTab',
  content: 'block+',
  defining: true,
  isolating: true,
  selectable: false,
  addAttributes() {
    return {
      title: {
        default: 'Вкладка',
        parseHTML: (element) => normalizeTaskTabTitle(element.getAttribute('data-aq-tab-title')),
        renderHTML: ({ title }) => ({ 'data-aq-tab-title': normalizeTaskTabTitle(title) }),
      },
    }
  },
  parseHTML() {
    return [{
      tag: 'div[data-aq-tab]',
      getContent(element, schema) {
        const content = ProseMirrorDOMParser.fromSchema(schema).parse(element).content
        return hasTextblock(content) ? content : content.append(Fragment.from(schema.nodes.paragraph.create()))
      },
    }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { class: 'aq-task-tabs__panel', 'data-aq-tab': 'true' }), 0]
  },
  renderText({ node, options }) {
    return `${normalizeTaskTabTitle(node.attrs.title)}\n${getText(node, options)}`
  },
  addNodeView() {
    return ({ node, view }) => {
      const dom = view.dom.ownerDocument.createElement('div')
      dom.className = 'aq-task-tabs__panel'
      dom.setAttribute('data-aq-tab', 'true')
      dom.setAttribute('data-aq-tab-title', normalizeTaskTabTitle(node.attrs.title))
      return {
        dom,
        contentDOM: dom,
        update(nextNode) {
          if (nextNode.type.name !== 'taskTab') return false
          dom.setAttribute('data-aq-tab-title', normalizeTaskTabTitle(nextNode.attrs.title))
          return true
        },
        ignoreMutation(mutation) {
          return mutation.type === 'attributes' && mutation.target === dom
        },
      }
    }
  },
})

export const TaskTabs = Node.create({
  name: 'taskTabs',
  group: 'block',
  content: 'taskTab+',
  defining: true,
  isolating: true,
  parseHTML() {
    return [{ tag: 'div[data-aq-tabs]', contentElement: '.aq-task-tabs__panels' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { class: 'aq-task-tabs', 'data-aq-tabs': 'true' }), ['div', { class: 'aq-task-tabs__panels' }, 0]]
  },
  addNodeView() {
    return createTabsNodeView
  },
  addProseMirrorPlugins() {
    return [new Plugin({
      appendTransaction(transactions, _oldState, state) {
        if (!transactions.some((transaction) => transaction.docChanged)) return null
        const closeNextHistory = transactions.some((transaction) => transaction.getMeta(TABS_HISTORY_ACTION))
        const positions = []
        state.doc.descendants((node, position) => {
          if (node.type.name === 'taskTab' && !hasTextblock(node)) positions.push(position + node.nodeSize - 1)
        })
        if (!positions.length && !closeNextHistory) return null
        const tr = state.tr
        positions.reverse().forEach((position) => tr.insert(position, state.schema.nodes.paragraph.create()))
        if (closeNextHistory) closeHistory(tr)
        return tr
      },
    })]
  },
  addCommands() {
    return {
      insertTaskTabs: () => ({ state, tr, dispatch }) => {
        const { $from } = state.selection
        for (let depth = $from.depth; depth > 0; depth -= 1) {
          if ($from.node(depth).type.name === this.name) return false
        }
        if (!dispatch) return true
        const block = state.schema.nodeFromJSON(createTaskTabsContent())
        tr.replaceSelectionWith(block)
        let position = null
        tr.doc.descendants((child, pos) => {
          if (child === block) position = pos
          return child !== block
        })
        if (position === null) return false
        const end = position + block.nodeSize
        if (!tr.doc.nodeAt(end)) tr.insert(end, state.schema.nodes.paragraph.create())
        tr.setSelection(TextSelection.near(tr.doc.resolve(position + 2), 1))
        tabAction(tr)
        tr.scrollIntoView()
        return true
      },
    }
  },
})
