'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import PropTypes from 'prop-types'
import { getClassicEffectLabel } from '@helpers/classicItemDefinitions'

export default function ClassicInventoryPopover({ items = [], busy = false, onUse, triggerRef }) {
  const [container, setContainer] = useState(null)
  const [isOpen, setIsOpen] = useState(false)
  const rootRef = useRef(null)
  const panelRef = useRef(null)
  const id = useId()

  useEffect(() => { setContainer(document.body) }, [])

  useEffect(() => {
    if (!isOpen) return undefined
    panelRef.current?.focus()
    const outside = (event) => {
      if (!rootRef.current?.contains(event.target)) setIsOpen(false)
    }
    const escape = (event) => {
      if (event.key !== 'Escape' || event.defaultPrevented || document.querySelector('[data-aq-modal-dialog]')) return
      event.preventDefault()
      setIsOpen(false)
      triggerRef.current?.focus()
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape)
    }
  }, [isOpen, triggerRef])

  if (!container) return null
  return createPortal(
    <div ref={rootRef} className="fixed z-[70]" style={{ right: 'max(1rem, env(safe-area-inset-right, 0px))', bottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}>
      {isOpen && <section
        ref={panelRef}
        id={id}
        role="dialog"
        aria-label="Инвентарь команды"
        tabIndex={-1}
        className="absolute bottom-[calc(100%+0.75rem)] right-0 flex w-[min(22rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-xl outline-none dark:border-cyan-800 dark:bg-slate-900 dark:text-slate-100"
        style={{ maxHeight: 'min(28rem, calc(100dvh - 9rem))' }}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <div><h3 className="font-semibold">Инвентарь</h3><p className="text-xs text-slate-500 dark:text-slate-400">Видов предметов: {items.length}</p></div>
          <button type="button" aria-label="Закрыть инвентарь" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-2xl text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-cyan-600 dark:text-slate-300 dark:hover:bg-slate-800" onClick={() => { setIsOpen(false); triggerRef.current?.focus() }}>×</button>
        </div>
        <div className="min-h-0 overflow-y-auto overscroll-contain p-3">
          {items.length > 0 ? <ul className="space-y-2">{items.map((item) => <li key={item.itemId} className="min-w-0 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
            <div className="flex items-start justify-between gap-3"><p className="min-w-0 break-words text-sm font-semibold">{item.title}</p><span className="shrink-0 rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">×{item.quantity}</span></div>
            {item.description && <p className="mt-1 whitespace-pre-wrap break-words text-xs text-slate-600 dark:text-slate-300">{item.description}</p>}
            {item.effect && <div className="mt-2 space-y-2">
              <p className="text-xs text-cyan-800 dark:text-cyan-200">{getClassicEffectLabel(item.effect)}</p>
              <button type="button" className="aq-modal-btn aq-modal-btn-secondary w-full" disabled={busy || !item.canUse} onClick={() => { setIsOpen(false); onUse(item) }}>Применить предмет</button>
              {item.useBlockReason && <p className="text-xs text-slate-500 dark:text-slate-400">{item.useBlockReason}</p>}
            </div>}
          </li>)}</ul> : <p className="p-3 text-sm text-slate-600 dark:text-slate-300">Инвентарь пуст. Полученные предметы появятся здесь.</p>}
        </div>
      </section>}
      <button
        ref={triggerRef}
        data-classic-inventory-trigger
        type="button"
        aria-label="Инвентарь"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={isOpen ? id : undefined}
        className="inline-flex min-h-12 items-center gap-2 rounded-2xl border border-cyan-600 bg-cyan-700 px-4 py-3 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-cyan-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-600 dark:border-cyan-200 dark:bg-cyan-300 dark:text-slate-950 dark:hover:bg-cyan-200"
        onClick={() => setIsOpen((open) => !open)}
      >
        <svg aria-hidden="true" width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M8 7V5a4 4 0 0 1 8 0v2M7 7h10a3 3 0 0 1 3 3v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V10a3 3 0 0 1 3-3Z" /><path d="M8 14h8v5H8zM9 10h6" /></svg>
        <span>Инвентарь</span>
        <span aria-hidden="true" className="min-w-5 rounded-md bg-white/20 px-1.5 py-0.5 text-center text-xs dark:bg-slate-950/10">{items.length}</span>
      </button>
    </div>, container,
  )
}

ClassicInventoryPopover.propTypes = {
  items: PropTypes.arrayOf(PropTypes.shape({ itemId: PropTypes.string.isRequired, title: PropTypes.string, description: PropTypes.string, quantity: PropTypes.number, effect: PropTypes.shape({ type: PropTypes.string, seconds: PropTypes.number }), canUse: PropTypes.bool, useBlockReason: PropTypes.string })),
  busy: PropTypes.bool,
  onUse: PropTypes.func.isRequired,
  triggerRef: PropTypes.shape({ current: PropTypes.any }).isRequired,
}
