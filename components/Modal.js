import { useEffect } from 'react'
import PropTypes from 'prop-types'
import { createPortal } from 'react-dom'

let activeModalLocks = 0
let previousBodyOverflow = ''

const Modal = ({
  isOpen,
  title,
  children,
  onClose,
  footer,
  compactMobile,
}) => {
  useEffect(() => {
    if (!isOpen) {
      return undefined
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose?.()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') {
      return undefined
    }

    const { body } = document
    if (activeModalLocks === 0) {
      previousBodyOverflow = body.style.overflow
      body.style.overflow = 'hidden'
    }

    activeModalLocks += 1

    return () => {
      activeModalLocks = Math.max(0, activeModalLocks - 1)
      if (activeModalLocks === 0) {
        body.style.overflow = previousBodyOverflow
      }
    }
  }, [isOpen])

  if (!isOpen) {
    return null
  }

  if (typeof document === 'undefined') {
    return null
  }

  const resolvedFooter = footer ?? (
    <button
      type="button"
      onClick={() => onClose?.()}
      className="aq-modal-btn aq-modal-btn-secondary"
    >
      Закрыть
    </button>
  )
  const horizontalPaddingClass = compactMobile ? 'px-3 sm:px-4 md:px-6' : 'px-6'

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-stretch justify-center p-0 md:items-center md:px-4 md:py-6">
      <div
        className="absolute inset-0 bg-slate-900/55 backdrop-blur-[2px] transition-colors dark:bg-slate-950/82"
        onClick={() => onClose?.()}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative z-10 flex h-full w-full flex-col overflow-hidden border border-slate-200/90 bg-white/95 shadow-[0_18px_46px_rgba(2,8,23,0.26)] dark:border-[#7A00FF]/35 dark:bg-[#090018]/96 dark:shadow-[0_0_0_1px_rgba(122,0,255,0.18),0_28px_64px_rgba(0,0,0,0.55)] md:h-auto md:max-h-[90vh] md:max-w-5xl md:rounded-2xl"
      >
        <div className={`flex shrink-0 items-start justify-between gap-4 border-b border-slate-200/85 bg-white/95 py-4 dark:border-[#00D1FF]/25 dark:bg-[#090018]/95 ${horizontalPaddingClass}`}>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-[#f3ecff]">{title}</h2>
          <button
            type="button"
            onClick={() => onClose?.()}
            className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-slate-300 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:border-[#00D1FF]/35 dark:text-[#bdf4ff] dark:hover:bg-[#00D1FF]/12 dark:hover:text-[#e9fbff]"
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>
        <div className={`min-h-0 flex-1 overflow-y-auto py-5 ${horizontalPaddingClass}`}>
          {children}
        </div>
        <div className={`flex shrink-0 flex-row flex-wrap items-center justify-end gap-3 border-t border-slate-200/85 bg-white/95 py-4 dark:border-[#00D1FF]/25 dark:bg-[#090018]/95 ${horizontalPaddingClass}`}>
          {resolvedFooter}
        </div>
      </div>
    </div>,
    document.body
  )
}

Modal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  title: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
  onClose: PropTypes.func,
  footer: PropTypes.node,
  compactMobile: PropTypes.bool,
}

Modal.defaultProps = {
  onClose: undefined,
  footer: null,
  compactMobile: false,
}

export default Modal

