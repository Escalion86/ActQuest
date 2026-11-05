import { normalizeTaskTabTitle } from './taskRichTabs.js'

const tabsSelector = 'div.aq-task-tabs[data-aq-tabs="true"]'
const panelSelector = 'div.aq-task-tabs__panel[data-aq-tab="true"]'
const enhancedBlocks = new WeakMap()
let instanceId = 0

const rememberAttributes = (element, names) => {
  const attributes = names.map((name) => [name, element.getAttribute(name)])

  return () => {
    attributes.forEach(([name, value]) => {
      if (value === null) {
        element.removeAttribute(name)
      } else {
        element.setAttribute(name, value)
      }
    })
  }
}

const pausePanelMedia = (panel) => {
  panel.querySelectorAll('audio, video').forEach((media) => media.pause())
}

export const enhanceTaskRichTabs = (root) => {
  if (!root?.querySelectorAll) return () => {}

  const blocks = [
    ...(root.matches?.(tabsSelector) ? [root] : []),
    ...root.querySelectorAll(tabsSelector),
  ]
  const cleanups = []

  blocks.forEach((block) => {
    enhancedBlocks.get(block)?.()

    const panelsContainer = Array.from(block.children).find((element) =>
      element.matches('div.aq-task-tabs__panels'),
    )
    if (!panelsContainer) return

    const panels = Array.from(panelsContainer.children).filter((element) =>
      element.matches(panelSelector),
    )
    if (!panels.length) return

    const document = block.ownerDocument
    let prefix
    do {
      prefix = `aq-task-tabs-${++instanceId}`
    } while (
      panels.some(
        (_, index) =>
          document.getElementById(`${prefix}-tab-${index}`) ||
          document.getElementById(`${prefix}-panel-${index}`),
      )
    )

    const restoreBlock = rememberAttributes(block, ['data-aq-tabs-ready'])
    const restorePanels = panels.map((panel) =>
      rememberAttributes(panel, [
        'id',
        'role',
        'aria-labelledby',
        'tabindex',
        'hidden',
      ]),
    )
    const tablist = document.createElement('nav')
    tablist.className = 'aq-task-tabs__tablist'
    tablist.setAttribute('role', 'tablist')
    tablist.setAttribute('aria-label', 'Материалы задания')

    const buttons = panels.map((panel, index) => {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'aq-task-tabs__tab'
      button.id = `${prefix}-tab-${index}`
      button.setAttribute('role', 'tab')
      button.textContent = normalizeTaskTabTitle(
        panel.getAttribute('data-aq-tab-title'),
        `Вкладка ${index + 1}`,
      )
      panel.id = `${prefix}-panel-${index}`
      panel.setAttribute('role', 'tabpanel')
      panel.setAttribute('aria-labelledby', button.id)
      panel.tabIndex = 0
      button.setAttribute('aria-controls', panel.id)
      tablist.append(button)
      return button
    })

    const selectTab = (selectedIndex, focus = false) => {
      panels.forEach((panel, index) => {
        const selected = index === selectedIndex
        if (!selected && !panel.hidden) pausePanelMedia(panel)
        panel.hidden = !selected
        buttons[index].setAttribute('aria-selected', String(selected))
        buttons[index].tabIndex = selected ? 0 : -1
      })
      if (focus) buttons[selectedIndex].focus()
    }

    const handleClick = (event) => {
      const index = buttons.indexOf(event.target)
      if (index !== -1) selectTab(index)
    }

    const handleKeyDown = (event) => {
      const index = buttons.indexOf(event.target)
      if (index === -1 || event.altKey || event.ctrlKey || event.metaKey) return

      let nextIndex
      switch (event.key) {
        case 'ArrowLeft':
          nextIndex = (index - 1 + panels.length) % panels.length
          break
        case 'ArrowRight':
          nextIndex = (index + 1) % panels.length
          break
        case 'Home':
          nextIndex = 0
          break
        case 'End':
          nextIndex = panels.length - 1
          break
        default:
          return
      }

      event.preventDefault()
      selectTab(nextIndex, true)
    }

    selectTab(0)
    tablist.addEventListener('click', handleClick)
    tablist.addEventListener('keydown', handleKeyDown)
    block.insertBefore(tablist, panelsContainer)
    block.setAttribute('data-aq-tabs-ready', 'true')

    let cleaned = false
    const cleanup = () => {
      if (cleaned) return
      cleaned = true
      tablist.removeEventListener('click', handleClick)
      tablist.removeEventListener('keydown', handleKeyDown)
      tablist.remove()
      restorePanels.forEach((restore) => restore())
      restoreBlock()
      enhancedBlocks.delete(block)
    }
    enhancedBlocks.set(block, cleanup)
    cleanups.push(cleanup)
  })

  return () => cleanups.forEach((cleanup) => cleanup())
}
