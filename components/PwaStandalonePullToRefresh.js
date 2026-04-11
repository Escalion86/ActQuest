'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

const MAX_PULL_DISTANCE = 110
const TRIGGER_DISTANCE = 70
const REFRESH_COOLDOWN_MS = 1200

const isScrollableElement = (element) => {
  if (!(element instanceof HTMLElement)) {
    return false
  }

  const style = window.getComputedStyle(element)
  const overflowY = style?.overflowY || ''
  const canScroll =
    overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay'

  return canScroll && element.scrollHeight > element.clientHeight + 1
}

const findScrollableContainer = (target) => {
  let node = target instanceof HTMLElement ? target : null

  while (node && node !== document.body) {
    if (isScrollableElement(node)) {
      return node
    }
    node = node.parentElement
  }

  const rootScroller = document.scrollingElement || document.documentElement
  return rootScroller instanceof HTMLElement ? rootScroller : null
}

const isElementAtTop = (element) => {
  if (!(element instanceof HTMLElement)) {
    return window.scrollY <= 0
  }
  return element.scrollTop <= 0
}

const isStandaloneIos = () => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false
  }

  const ua = navigator.userAgent || ''
  const isIosDevice =
    /iPhone|iPad|iPod/i.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const isStandaloneMode =
    window.matchMedia?.('(display-mode: standalone)')?.matches === true ||
    window.navigator.standalone === true

  return isIosDevice && isStandaloneMode
}

export default function PwaStandalonePullToRefresh() {
  const router = useRouter()
  const enabled = useMemo(() => isStandaloneIos(), [])

  const [pullDistance, setPullDistance] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const stateRef = useRef({
    tracking: false,
    armed: false,
    startY: 0,
    startX: 0,
    scrollContainer: null,
    lastRefreshAt: 0,
  })

  useEffect(() => {
    if (!enabled) {
      return undefined
    }

    const handleTouchStart = (event) => {
      if (event.touches.length !== 1) {
        stateRef.current.tracking = false
        return
      }

      const touch = event.touches[0]
      const target = event.target instanceof HTMLElement ? event.target : null
      const scrollContainer = findScrollableContainer(target)

      if (!isElementAtTop(scrollContainer)) {
        stateRef.current.tracking = false
        return
      }

      stateRef.current.tracking = true
      stateRef.current.armed = false
      stateRef.current.startY = touch.clientY
      stateRef.current.startX = touch.clientX
      stateRef.current.scrollContainer = scrollContainer
      setPullDistance(0)
    }

    const handleTouchMove = (event) => {
      if (!stateRef.current.tracking || event.touches.length !== 1) {
        return
      }

      const touch = event.touches[0]
      const deltaY = touch.clientY - stateRef.current.startY
      const deltaX = touch.clientX - stateRef.current.startX

      if (deltaY <= 0 || Math.abs(deltaX) > Math.abs(deltaY)) {
        setPullDistance(0)
        stateRef.current.armed = false
        return
      }

      if (!isElementAtTop(stateRef.current.scrollContainer)) {
        stateRef.current.tracking = false
        stateRef.current.armed = false
        setPullDistance(0)
        return
      }

      const distance = Math.min(MAX_PULL_DISTANCE, Math.round(deltaY * 0.5))
      setPullDistance(distance)
      stateRef.current.armed = distance >= TRIGGER_DISTANCE

      if (distance > 0) {
        event.preventDefault()
      }
    }

    const handleTouchEnd = () => {
      if (!stateRef.current.tracking) {
        return
      }

      const shouldRefresh = stateRef.current.armed
      stateRef.current.tracking = false
      stateRef.current.armed = false
      setPullDistance(0)

      if (!shouldRefresh) {
        return
      }

      const now = Date.now()
      if (now - stateRef.current.lastRefreshAt < REFRESH_COOLDOWN_MS) {
        return
      }

      stateRef.current.lastRefreshAt = now
      setIsRefreshing(true)
      router.refresh()
      window.setTimeout(() => setIsRefreshing(false), 700)
    }

    window.addEventListener('touchstart', handleTouchStart, {
      passive: true,
      capture: true,
    })
    window.addEventListener('touchmove', handleTouchMove, {
      passive: false,
      capture: true,
    })
    window.addEventListener('touchend', handleTouchEnd, {
      passive: true,
      capture: true,
    })
    window.addEventListener('touchcancel', handleTouchEnd, {
      passive: true,
      capture: true,
    })

    return () => {
      window.removeEventListener('touchstart', handleTouchStart, true)
      window.removeEventListener('touchmove', handleTouchMove, true)
      window.removeEventListener('touchend', handleTouchEnd, true)
      window.removeEventListener('touchcancel', handleTouchEnd, true)
    }
  }, [enabled, router])

  if (!enabled) {
    return null
  }

  const visibleDistance = Math.max(pullDistance, isRefreshing ? 42 : 0)
  const opacity = Math.min(1, visibleDistance / 42)
  const rotate = Math.min(180, Math.round((visibleDistance / TRIGGER_DISTANCE) * 180))

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed left-0 right-0 top-2 z-[120] flex justify-center transition-opacity duration-150"
      style={{ opacity: visibleDistance > 0 || isRefreshing ? opacity : 0 }}
    >
      <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/40 bg-[#090018]/90 px-3 py-1.5 text-xs font-semibold text-[#bdf4ff] shadow-[0_8px_24px_rgba(0,0,0,0.35)] backdrop-blur-sm">
        <span
          className={`inline-block h-3.5 w-3.5 rounded-full border-2 border-cyan-300 border-t-transparent ${
            isRefreshing ? 'animate-spin' : ''
          }`}
          style={isRefreshing ? undefined : { transform: `rotate(${rotate}deg)` }}
        />
        {isRefreshing ? 'Обновляем…' : 'Потяните для обновления'}
      </div>
    </div>
  )
}

