import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { createPortal } from 'react-dom'
import clsx from 'clsx'

const SnackbarContext = createContext({
  enqueueSnackbar: () => null,
  closeSnackbar: () => {},
})

const defaultAnchor = { vertical: 'bottom', horizontal: 'left' }

const anchorToClasses = (anchor) => {
  const { vertical, horizontal } = anchor
  return {
    position: clsx('fixed z-[1000] flex pointer-events-none px-4 sm:px-6', {
      'top-4': vertical === 'top',
      'bottom-4': vertical === 'bottom',
      'left-1/2 -translate-x-1/2': horizontal === 'center',
      'left-4': horizontal === 'left',
      'right-4': horizontal === 'right',
    }),
    stack: clsx('flex w-full max-w-sm flex-col gap-3', {
      'items-start': horizontal === 'left',
      'items-end': horizontal === 'right',
      'items-center': horizontal === 'center',
    }),
  }
}

const variantClasses = {
  default: 'bg-neutral-800 text-white',
  error: 'bg-red-600 text-white',
  success: 'bg-green-600 text-white',
  warning: 'bg-amber-400 text-neutral-900',
  info: 'bg-sky-600 text-white',
}

const resolveNode = (content, key) => {
  if (typeof content === 'function') {
    return content(key)
  }

  return content
}

const SnackbarItem = ({ snack, closeSnackbar, fallbackAutoHideDuration }) => {
  const { key, message, options } = snack
  const { persist, autoHideDuration, variant = 'default', className, action, onClose } = options
  const timerRef = useRef(null)
  const duration = persist ? null : autoHideDuration ?? fallbackAutoHideDuration

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  useEffect(() => {
    if (duration === null || duration === undefined) {
      return undefined
    }

    timerRef.current = setTimeout(() => {
      closeSnackbar(key, 'timeout')
    }, duration)

    return () => {
      clearTimer()
    }
  }, [closeSnackbar, duration, key])

  useEffect(() => () => {
    clearTimer()
  }, [])

  const handleClose = useCallback(
    (reason) => {
      clearTimer()
      closeSnackbar(key, reason)
    },
    [closeSnackbar, key]
  )

  useEffect(() => {
    return () => {
      if (typeof onClose === 'function') {
        onClose(null, 'unmount', key)
      }
    }
  }, [key, onClose])

  const resolvedAction = resolveNode(action, key)

  const mergedClasses = clsx(
    'pointer-events-auto w-full rounded-lg shadow-lg ring-1 ring-black/10 transition-all duration-200 ease-in-out',
    variantClasses[variant] ?? variantClasses.default,
    className
  )

  return (
    <div className={mergedClasses} role="alert">
      <div className="flex items-start gap-3 p-4">
        <div className="flex-1 text-sm leading-snug">{resolveNode(message, key)}</div>
        {resolvedAction ? <div className="flex items-center">{resolvedAction}</div> : null}
      </div>
      <button
        type="button"
        aria-label="Закрыть уведомление"
        className="sr-only"
        onClick={() => handleClose('clickaway')}
      >
        Закрыть
      </button>
    </div>
  )
}

SnackbarItem.propTypes = {
  closeSnackbar: PropTypes.func.isRequired,
  fallbackAutoHideDuration: PropTypes.number,
  snack: PropTypes.shape({
    key: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    message: PropTypes.oneOfType([PropTypes.node, PropTypes.func]).isRequired,
    options: PropTypes.shape({
      action: PropTypes.oneOfType([PropTypes.node, PropTypes.func]),
      autoHideDuration: PropTypes.number,
      className: PropTypes.string,
      onClose: PropTypes.func,
      persist: PropTypes.bool,
      variant: PropTypes.string,
    }),
  }).isRequired,
}

SnackbarItem.defaultProps = {
  fallbackAutoHideDuration: 4000,
}

let keySeed = Date.now()

const createKey = (inputKey) => {
  if (inputKey !== undefined && inputKey !== null) {
    return inputKey
  }
  keySeed += 1
  return keySeed
}

export const SnackbarProvider = ({
  children,
  maxSnack = 3,
  autoHideDuration = 4000,
  anchorOrigin = defaultAnchor,
  preventDuplicate = false,
}) => {
  const [snacks, setSnacks] = useState([])
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
    return () => {
      setIsMounted(false)
    }
  }, [])

  const closeSnackbar = useCallback((key, reason = 'dismissed') => {
    setSnacks((current) => {
      if (key === undefined) {
        current.forEach((item) => {
          item.options?.onClose?.(null, reason, item.key)
        })
        return []
      }

      const target = current.find((item) => item.key === key)
      if (target && typeof target.options?.onClose === 'function') {
        target.options.onClose(null, reason, key)
      }

      return current.filter((item) => item.key !== key)
    })
  }, [])

  const enqueueSnackbar = useCallback(
    (message, options = {}) => {
      const nextKey = createKey(options.key)
      setSnacks((current) => {
        if (preventDuplicate && current.some((item) => item.message === message)) {
          return current
        }

        const nextSnack = { key: nextKey, message, options }
        const queue = [...current, nextSnack]

        if (queue.length > maxSnack) {
          const overflow = queue.length - maxSnack
          const removed = queue.splice(0, overflow)
          removed.forEach((item) => {
            item.options?.onClose?.(null, 'maxsnack', item.key)
          })
        }

        return queue
      })
      return nextKey
    },
    [maxSnack, preventDuplicate]
  )

  const contextValue = useMemo(
    () => ({
      enqueueSnackbar,
      closeSnackbar,
    }),
    [closeSnackbar, enqueueSnackbar]
  )

  const anchorClasses = useMemo(() => anchorToClasses(anchorOrigin), [anchorOrigin])

  return (
    <SnackbarContext.Provider value={contextValue}>
      {children}
      {isMounted
        ? createPortal(
            <div className={anchorClasses.position}>
              <div className={anchorClasses.stack}>
                {snacks.map((snack) => (
                  <SnackbarItem
                    key={snack.key}
                    snack={snack}
                    closeSnackbar={closeSnackbar}
                    fallbackAutoHideDuration={autoHideDuration}
                  />
                ))}
              </div>
            </div>,
            document.body
          )
        : null}
    </SnackbarContext.Provider>
  )
}

SnackbarProvider.propTypes = {
  anchorOrigin: PropTypes.shape({
    horizontal: PropTypes.oneOf(['left', 'center', 'right']),
    vertical: PropTypes.oneOf(['top', 'bottom']),
  }),
  autoHideDuration: PropTypes.number,
  children: PropTypes.node.isRequired,
  maxSnack: PropTypes.number,
  preventDuplicate: PropTypes.bool,
}

SnackbarProvider.defaultProps = {
  anchorOrigin: defaultAnchor,
  autoHideDuration: 4000,
  maxSnack: 3,
  preventDuplicate: false,
}

export const useSnackbar = () => useContext(SnackbarContext)

export const withSnackbar = (Component) => {
  const WithSnackbar = (props) => {
    const snackbar = useSnackbar()
    return <Component {...props} snackbar={snackbar} />
  }

  WithSnackbar.displayName = `WithSnackbar(${Component.displayName || Component.name || 'Component'})`
  return WithSnackbar
}

export default SnackbarProvider
