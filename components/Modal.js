import { useEffect } from 'react'
import PropTypes from 'prop-types'

const Modal = ({
  isOpen,
  title,
  children,
  onClose,
  footer,
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

  if (!isOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center p-0 md:items-center md:px-4 md:py-6">
      <div
        className="absolute inset-0 bg-slate-900/50 transition-colors dark:bg-slate-950/80"
        onClick={() => onClose?.()}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative z-10 flex h-full w-full flex-col overflow-y-auto bg-white shadow-xl dark:bg-slate-900/95 md:h-auto md:max-h-[90vh] md:max-w-5xl md:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-4 dark:border-slate-700/60">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-white">{title}</h2>
          <button
            type="button"
            onClick={() => onClose?.()}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:border-slate-700 dark:hover:bg-slate-800"
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
        {footer ? (
          <div className="flex flex-col gap-3 px-6 pb-6 sm:flex-row sm:items-center sm:justify-end">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  )
}

Modal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  title: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
  onClose: PropTypes.func,
  footer: PropTypes.node,
}

Modal.defaultProps = {
  onClose: undefined,
  footer: null,
}

export default Modal

