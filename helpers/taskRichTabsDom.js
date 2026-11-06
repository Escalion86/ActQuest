import { normalizeTaskTabsStyle, normalizeTaskTabTitle } from './taskRichTabs.js'
import { decorateTaskTabsNavigation, syncTaskTabsPresentation } from './taskRichTabsPresentation.js'

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
    const style = normalizeTaskTabsStyle(block.getAttribute('data-aq-tabs-style'))
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

    const restoreBlock = rememberAttributes(block, ['data-aq-tabs-ready', 'data-aq-tabs-style'])
    block.setAttribute('data-aq-tabs-style', style)
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
    const row = document.createElement('div')
    row.className = 'aq-task-tabs__tab-row'
    const backButton = document.createElement('button')
    backButton.type = 'button'
    backButton.className = 'aq-task-tabs__button aq-task-tabs__back'
    backButton.textContent = 'К списку вкладок'
    row.append(backButton, tablist)
    const bodies = []
    const toggles = []
    const titles = []

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
      panel.removeAttribute('tabindex')
      const body = document.createElement('div')
      body.className = 'aq-task-tabs__body'
      body.id = `${prefix}-body-${index}`
      body.tabIndex = 0
      body.append(...panel.childNodes)
      const toggle = document.createElement('button')
      toggle.type = 'button'
      toggle.className = 'aq-task-tabs__accordion-toggle'
      toggle.id = `${prefix}-accordion-${index}`
      toggle.textContent = button.textContent
      const title = document.createElement('h3')
      title.className = 'aq-task-tabs__detail-title'
      title.textContent = button.textContent
      panel.append(toggle, title, body)
      bodies.push(body)
      toggles.push(toggle)
      titles.push(title)
      button.setAttribute('aria-controls', panel.id)
      tablist.append(button)
      return button
    })

    decorateTaskTabsNavigation(tablist, style)
    let activeIndex = ['cards', 'accordion'].includes(style) ? -1 : 0
    const selectTab = (selectedIndex, focus = false) => {
      activeIndex = selectedIndex
      syncTaskTabsPresentation({ block, tablist, panels, activeIndex, backButton })
      if (focus) {
        if (style === 'cards') bodies[selectedIndex].focus()
        else buttons[selectedIndex].focus()
      }
    }

    const handleClick = (event) => {
      const index = buttons.indexOf(event.target)
      if (index !== -1) {
        selectTab(index)
        if (style === 'cards') bodies[index].focus()
      }
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

    const handleAccordionClick = (event) => {
      const index = toggles.indexOf(event.target)
      if (index !== -1) selectTab(activeIndex === index ? -1 : index)
    }
    const handleAccordionKeyDown = (event) => {
      const index = toggles.indexOf(event.target)
      if (index === -1 || event.altKey || event.ctrlKey || event.metaKey) return
      if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return
      event.preventDefault()
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? toggles.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + toggles.length) % toggles.length
      toggles[next].focus()
    }
    const handleBack = () => {
      const previousIndex = activeIndex
      selectTab(-1)
      buttons[previousIndex]?.focus()
    }
    selectTab(activeIndex)
    tablist.addEventListener('click', handleClick)
    tablist.addEventListener('keydown', handleKeyDown)
    panelsContainer.addEventListener('click', handleAccordionClick)
    panelsContainer.addEventListener('keydown', handleAccordionKeyDown)
    backButton.addEventListener('click', handleBack)
    block.insertBefore(row, panelsContainer)
    block.setAttribute('data-aq-tabs-ready', 'true')

    let cleaned = false
    const cleanup = () => {
      if (cleaned) return
      cleaned = true
      tablist.removeEventListener('click', handleClick)
      tablist.removeEventListener('keydown', handleKeyDown)
      panelsContainer.removeEventListener('click', handleAccordionClick)
      panelsContainer.removeEventListener('keydown', handleAccordionKeyDown)
      backButton.removeEventListener('click', handleBack)
      row.remove()
      panels.forEach((panel, index) => {
        bodies[index].replaceWith(...bodies[index].childNodes)
        toggles[index].remove()
        titles[index].remove()
      })
      restorePanels.forEach((restore) => restore())
      restoreBlock()
      enhancedBlocks.delete(block)
    }
    enhancedBlocks.set(block, cleanup)
    cleanups.push(cleanup)
  })

  return () => cleanups.forEach((cleanup) => cleanup())
}
