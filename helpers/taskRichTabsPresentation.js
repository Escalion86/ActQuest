import { normalizeTaskTabsStyle } from './taskRichTabs.js'

// Общая геометрия и состояния для редактора и HTML-просмотра.
export const decorateTaskTabsNavigation = (tablist, style) => {
  const buttons = Array.from(tablist.querySelectorAll('[role="tab"]'))
  buttons.forEach((button, index) => button.setAttribute('data-number', String(index + 1)))
  const dense = buttons.length > 4
  if (style === 'map' && dense) tablist.style.setProperty('--aq-map-height', `${Math.ceil(buttons.length / 2) * 160}px`)
  else tablist.style.removeProperty('--aq-map-height')
  tablist.setAttribute('data-dense', String(dense))
  if (style !== 'map') return

  const document = tablist.ownerDocument
  const namespace = 'http://www.w3.org/2000/svg'
  const lines = document.createElementNS(namespace, 'svg')
  lines.classList.add('aq-task-tabs__connections')
  lines.setAttribute('viewBox', '0 0 100 100')
  lines.setAttribute('preserveAspectRatio', 'none')
  lines.setAttribute('aria-hidden', 'true')
  const points = buttons.map((button, index) => {
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / buttons.length
    const row = Math.floor(index / 2)
    const column = row % 2 === 0 ? index % 2 : 1 - index % 2
    const x = dense ? 25 + 50 * column : buttons.length === 1 ? 50 : 50 + 35 * Math.cos(angle)
    const y = dense ? ((row + 0.5) * 100) / Math.ceil(buttons.length / 2) : buttons.length === 1 ? 50 : 50 + 35 * Math.sin(angle)
    button.style.setProperty('--aq-node-x', `${x}%`)
    button.style.setProperty('--aq-node-y', `${y}%`)
    return [x, y]
  })
  points.forEach(([x, y], index) => {
    if (points.length < 2 || (points.length === 2 && index === 1) || (dense && index === points.length - 1)) return
    const next = points[(index + 1) % points.length]
    const line = document.createElementNS(namespace, 'line')
    for (const [name, value] of Object.entries({ x1: x, y1: y, x2: next[0], y2: next[1] })) {
      line.setAttribute(name, String(value))
    }
    lines.append(line)
  })
  tablist.prepend(lines)
}

export const syncTaskTabsPresentation = ({ block, tablist, panels, activeIndex, backButton }) => {
  const style = normalizeTaskTabsStyle(block.getAttribute('data-aq-tabs-style'))
  const accordion = style === 'accordion'
  const cards = style === 'cards'
  const buttons = Array.from(tablist.querySelectorAll('[role="tab"]'))
  tablist.hidden = accordion || (cards && activeIndex >= 0)
  backButton.hidden = !cards || activeIndex < 0
  panels.forEach((panel, index) => {
    const selected = index === activeIndex
    const toggle = panel.querySelector(':scope > .aq-task-tabs__accordion-toggle')
    const body = panel.querySelector(':scope > .aq-task-tabs__body')
    const title = panel.querySelector(':scope > .aq-task-tabs__detail-title')
    title.hidden = style !== 'cards' && style !== 'map'
    if (!selected) panel.querySelectorAll('audio, video').forEach((media) => media.pause())
    panel.hidden = !accordion && !selected
    panel.setAttribute('role', accordion ? 'group' : 'tabpanel')
    panel.setAttribute('aria-labelledby', accordion ? toggle.id : buttons[index].id)
    body.hidden = !selected
    toggle.hidden = !accordion
    toggle.setAttribute('aria-expanded', String(selected))
    toggle.setAttribute('aria-controls', body.id)
    toggle.setAttribute('data-number', String(index + 1))
    if (accordion) {
      body.setAttribute('role', 'region')
      body.setAttribute('aria-labelledby', toggle.id)
    } else {
      body.removeAttribute('role')
      body.removeAttribute('aria-labelledby')
    }
    buttons[index].setAttribute('aria-selected', String(selected))
    buttons[index].tabIndex = selected || (activeIndex < 0 && index === 0) ? 0 : -1
  })
}
