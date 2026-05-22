'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import PropTypes from 'prop-types'

const MIN_SCALE = 1
const MAX_SCALE = 4
const SCALE_STEP = 0.25

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
const getDistance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)
const getImageFileName = (src) => {
  const fallback = 'actquest-image'

  try {
    const url = new URL(src, window.location.href)
    const lastPathPart = decodeURIComponent(
      url.pathname.split('/').filter(Boolean).pop() || '',
    )
    return lastPathPart || fallback
  } catch {
    return fallback
  }
}
const triggerDownload = (href, fileName) => {
  const link = document.createElement('a')
  link.href = href
  link.download = fileName
  link.rel = 'noopener noreferrer'
  document.body.appendChild(link)
  link.click()
  link.remove()
}

export default function FullscreenImageViewer({ isOpen, src, alt, onClose }) {
  const [scale, setScale] = useState(MIN_SCALE)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const dragStateRef = useRef(null)
  const activePointersRef = useRef(new Map())
  const pinchStateRef = useRef(null)

  useEffect(() => {
    if (!isOpen) {
      return undefined
    }
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose?.()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [isOpen, onClose])

  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') {
      return undefined
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) {
      setScale(MIN_SCALE)
      setOffset({ x: 0, y: 0 })
      dragStateRef.current = null
      pinchStateRef.current = null
      activePointersRef.current.clear()
    }
  }, [isOpen, src])

  const zoomIn = useCallback(() => {
    setScale((prev) => clamp(prev + SCALE_STEP, MIN_SCALE, MAX_SCALE))
  }, [])

  const zoomOut = useCallback(() => {
    setScale((prev) => clamp(prev - SCALE_STEP, MIN_SCALE, MAX_SCALE))
  }, [])

  const resetView = useCallback(() => {
    setScale(MIN_SCALE)
    setOffset({ x: 0, y: 0 })
  }, [])

  const downloadImage = useCallback(async () => {
    if (!src || typeof document === 'undefined') {
      return
    }

    const fileName = getImageFileName(src)

    try {
      const response = await fetch(src)
      if (!response.ok) {
        throw new Error('Image download failed')
      }

      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)
      triggerDownload(objectUrl, fileName)
      URL.revokeObjectURL(objectUrl)
    } catch {
      triggerDownload(src, fileName)
    }
  }, [src])

  const onWheel = useCallback(
    (event) => {
      event.preventDefault()
      if (event.deltaY < 0) {
        zoomIn()
      } else {
        zoomOut()
      }
    },
    [zoomIn, zoomOut],
  )

  const onPointerDown = useCallback(
    (event) => {
      const pointers = activePointersRef.current
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })

      if (event.pointerType === 'touch') {
        event.preventDefault()
      }

      if (pointers.size >= 2) {
        const values = Array.from(pointers.values())
        const first = values[0]
        const second = values[1]
        pinchStateRef.current = {
          startDistance: getDistance(first, second),
          startScale: scale,
        }
        dragStateRef.current = null
        event.currentTarget.setPointerCapture?.(event.pointerId)
        return
      }

      if (scale > MIN_SCALE) {
        dragStateRef.current = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          offsetX: offset.x,
          offsetY: offset.y,
        }
      }
      event.currentTarget.setPointerCapture?.(event.pointerId)
    },
    [scale, offset],
  )

  const onPointerMove = useCallback(
    (event) => {
      const pointers = activePointersRef.current
      if (pointers.has(event.pointerId)) {
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
      }

      if (pinchStateRef.current && pointers.size >= 2) {
        const values = Array.from(pointers.values())
        const first = values[0]
        const second = values[1]
        const nextDistance = getDistance(first, second)
        const startDistance = pinchStateRef.current.startDistance
        if (startDistance > 0) {
          const factor = nextDistance / startDistance
          const nextScale = clamp(
            pinchStateRef.current.startScale * factor,
            MIN_SCALE,
            MAX_SCALE,
          )
          setScale(nextScale)
          if (nextScale <= MIN_SCALE) {
            setOffset({ x: 0, y: 0 })
          }
        }
        if (event.pointerType === 'touch') {
          event.preventDefault()
        }
        return
      }

      const dragState = dragStateRef.current
      if (!dragState || dragState.pointerId !== event.pointerId) {
        return
      }
      const nextX = dragState.offsetX + (event.clientX - dragState.startX)
      const nextY = dragState.offsetY + (event.clientY - dragState.startY)
      setOffset({ x: nextX, y: nextY })
    },
    [],
  )

  const onPointerUp = useCallback(
    (event) => {
      activePointersRef.current.delete(event.pointerId)
      event.currentTarget.releasePointerCapture?.(event.pointerId)

      const dragState = dragStateRef.current
      if (dragState && dragState.pointerId === event.pointerId) {
        dragStateRef.current = null
      }

      if (activePointersRef.current.size < 2) {
        pinchStateRef.current = null
      }

      if (activePointersRef.current.size === 1 && scale > MIN_SCALE) {
        const [nextPointerId, nextPointer] = Array.from(
          activePointersRef.current.entries(),
        )[0]
        dragStateRef.current = {
          pointerId: nextPointerId,
          startX: nextPointer.x,
          startY: nextPointer.y,
          offsetX: offset.x,
          offsetY: offset.y,
        }
      }
    },
    [offset.x, offset.y, scale],
  )

  const imageTransform = useMemo(
    () =>
      `translate(${Math.round(offset.x)}px, ${Math.round(offset.y)}px) scale(${scale})`,
    [offset.x, offset.y, scale],
  )

  if (!isOpen || typeof document === 'undefined' || !src) {
    return null
  }

  return createPortal(
    <div className="fixed inset-0 z-[220]">
      <div
        className="absolute inset-0 bg-slate-950/95"
        aria-hidden="true"
        onClick={() => onClose?.()}
      />

      <div className="relative z-10 flex h-full w-full flex-col">
        <div className="flex items-center justify-end gap-2 border-b border-white/10 px-3 py-3 sm:px-4">
          <button
            type="button"
            onClick={zoomOut}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/25 bg-white/10 text-lg text-white transition hover:bg-white/20"
            aria-label="Уменьшить"
          >
            −
          </button>
          <button
            type="button"
            onClick={zoomIn}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/25 bg-white/10 text-lg text-white transition hover:bg-white/20"
            aria-label="Увеличить"
          >
            +
          </button>
          <button
            type="button"
            onClick={resetView}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/25 bg-white/10 text-white transition hover:bg-white/20"
            aria-label="Под размер экрана"
            title="Под размер экрана"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M8 3H3v5" />
              <path d="M16 3h5v5" />
              <path d="M21 16v5h-5" />
              <path d="M3 16v5h5" />
              <path d="M9 9L3 3" />
              <path d="M15 9l6-6" />
              <path d="M15 15l6 6" />
              <path d="M9 15l-6 6" />
            </svg>
          </button>
          <button
            type="button"
            onClick={downloadImage}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/25 bg-white/10 text-white transition hover:bg-white/20"
            aria-label="Скачать изображение"
            title="Скачать изображение"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 3v12" />
              <path d="m7 10 5 5 5-5" />
              <path d="M5 21h14" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => onClose?.()}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/25 bg-white/10 text-xl leading-none text-white transition hover:bg-white/20"
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>

        <div
          className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden p-3 sm:p-6"
          onWheel={onWheel}
        >
          <img
            src={src}
            alt={alt}
            className={`max-h-full max-w-full select-none object-contain ${scale > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-zoom-in'}`}
            style={{
              transform: imageTransform,
              transformOrigin: 'center center',
              touchAction: 'none',
            }}
            onDoubleClick={zoomIn}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onPointerLeave={onPointerUp}
            draggable={false}
          />
        </div>
      </div>
    </div>,
    document.body,
  )
}

FullscreenImageViewer.propTypes = {
  isOpen: PropTypes.bool,
  src: PropTypes.string,
  alt: PropTypes.string,
  onClose: PropTypes.func,
}

FullscreenImageViewer.defaultProps = {
  isOpen: false,
  src: '',
  alt: 'Изображение',
  onClose: undefined,
}
