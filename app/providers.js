'use client'

import PropTypes from 'prop-types'
import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { SessionProvider } from 'next-auth/react'
import { Provider as JotaiProvider } from 'jotai'
import { SnackbarProvider } from 'lib/notistack'

const SITE_AUDIO_SRC = '/sounds/Cibircatacombs.mp3'

export default function AppProviders({ children }) {
  const pathname = usePathname()
  const isProductionRuntime = process.env.NODE_ENV === 'production'
  const audioRef = useRef(null)
  const [isMuted, setIsMuted] = useState(false)
  const [hasStartedPlayback, setHasStartedPlayback] = useState(false)
  const [isAudioReady, setIsAudioReady] = useState(false)
  const [lastAudioError, setLastAudioError] = useState('')
  const [isAudioHintDismissed, setIsAudioHintDismissed] = useState(false)
  const isCabinetRoute = String(pathname || '').startsWith('/cabinet')
  const isLandingRoute = pathname === '/'

  const tryPlayAudio = async () => {
    const audio = audioRef.current
    if (!audio || isMuted || isCabinetRoute) return false

    try {
      if (audio.readyState < 2) {
        audio.load()
      }
      await audio.play()
      setHasStartedPlayback(true)
      setLastAudioError('')
      setIsAudioHintDismissed(false)
      return true
    } catch (error) {
      const errorName =
        typeof error?.name === 'string' && error.name.trim()
          ? error.name.trim()
          : 'UnknownError'
      setLastAudioError(errorName)
      if (process.env.NODE_ENV !== 'production') {
        console.debug('[site-audio] play() rejected', {
          errorName,
          pathname,
          readyState: audio.readyState,
          muted: audio.muted,
          paused: audio.paused,
        })
      }
      return false
    }
  }

  useEffect(() => {
    if (typeof window !== 'undefined' && !('IntersectionObserver' in window)) {
      window.IntersectionObserver = class {
        constructor(callback) {
          this.callback = typeof callback === 'function' ? callback : () => {}
          this.elements = new Set()
        }

        observe(element) {
          if (!element) return
          this.elements.add(element)
          this.callback(
            [
              {
                isIntersecting: true,
                intersectionRatio: 1,
                target: element,
                time: Date.now(),
              },
            ],
            this,
          )
        }

        unobserve(element) {
          if (!element) return
          this.elements.delete(element)
        }

        disconnect() {
          this.elements.clear()
        }

        takeRecords() {
          return []
        }
      }
    }

    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return

    const syncServiceWorkerMode = async () => {
      try {
        if (isProductionRuntime) {
          await navigator.serviceWorker.register('/sw.js')
          return
        }

        const registrations = await navigator.serviceWorker.getRegistrations()
        await Promise.all(
          registrations.map(async (registration) => {
            const scope = registration?.scope || ''
            const scriptURL =
              registration?.active?.scriptURL ||
              registration?.installing?.scriptURL ||
              registration?.waiting?.scriptURL ||
              ''
            if (scope.includes(window.location.origin) || scriptURL.includes('/sw.js')) {
              await registration.unregister()
            }
          }),
        )

        if ('caches' in window) {
          const cacheNames = await caches.keys()
          await Promise.all(
            cacheNames
              .filter((name) => name.startsWith('actquest-cache-'))
              .map((name) => caches.delete(name)),
          )
        }
      } catch (error) {
        console.error('Service worker sync failed:', error)
      }
    }

    void syncServiceWorkerMode()
  }, [isProductionRuntime])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (typeof window.__chromium_devtools_metrics_reporter !== 'function') {
      window.__chromium_devtools_metrics_reporter = () => {}
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const savedMuted = localStorage.getItem('aq_site_audio_muted')
    if (savedMuted === '1') {
      setIsMuted(true)
    }
  }, [])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.muted = isMuted
    if (typeof window !== 'undefined') {
      localStorage.setItem('aq_site_audio_muted', isMuted ? '1' : '0')
    }
    if (isMuted) {
      audio.pause()
    }
  }, [isMuted])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    if (isCabinetRoute) {
      audio.pause()
      return
    }

    if (isLandingRoute && !isMuted && !hasStartedPlayback) {
      void tryPlayAudio()
      return
    }

    if (!isMuted && hasStartedPlayback && audio.paused) {
      void tryPlayAudio()
    }
  }, [pathname, isLandingRoute, isCabinetRoute, isMuted, hasStartedPlayback])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return undefined
    if (!isLandingRoute || isMuted || isCabinetRoute || hasStartedPlayback) {
      return undefined
    }

    const tryResume = () => {
      void tryPlayAudio()
    }

    audio.addEventListener('canplay', tryResume)
    window.addEventListener('pageshow', tryResume)
    document.addEventListener('visibilitychange', tryResume)

    return () => {
      audio.removeEventListener('canplay', tryResume)
      window.removeEventListener('pageshow', tryResume)
      document.removeEventListener('visibilitychange', tryResume)
    }
  }, [hasStartedPlayback, isCabinetRoute, isLandingRoute, isMuted])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (isMuted || hasStartedPlayback || isCabinetRoute) return

    const resumeFromGesture = () => {
      void tryPlayAudio()
    }

    window.addEventListener('pointerdown', resumeFromGesture, { passive: true })
    window.addEventListener('keydown', resumeFromGesture)
    window.addEventListener('touchstart', resumeFromGesture, { passive: true })

    return () => {
      window.removeEventListener('pointerdown', resumeFromGesture)
      window.removeEventListener('keydown', resumeFromGesture)
      window.removeEventListener('touchstart', resumeFromGesture)
    }
  }, [isMuted, hasStartedPlayback, isCabinetRoute])

  const handleAudioToggle = async () => {
    const nextMuted = !isMuted
    setIsMuted(nextMuted)
    if (!nextMuted) {
      await tryPlayAudio()
    }
  }

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.readyState >= 2) {
      setIsAudioReady(true)
    }
  }, [pathname])

  useEffect(() => {
    if (lastAudioError === 'NotAllowedError') {
      setIsAudioHintDismissed(false)
    }
  }, [lastAudioError])

  const showAudioUnlockHint =
    !isCabinetRoute &&
    isLandingRoute &&
    !isMuted &&
    !hasStartedPlayback &&
    !isAudioHintDismissed &&
    lastAudioError === 'NotAllowedError'

  const handleEnableAudio = async () => {
    const started = await tryPlayAudio()
    if (!started) return
    setIsAudioHintDismissed(false)
  }

  return (
    <SessionProvider refetchInterval={5 * 60}>
      <SnackbarProvider
        maxSnack={4}
        autoHideDuration={4000}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <JotaiProvider>
          <audio
            ref={audioRef}
            src={SITE_AUDIO_SRC}
            loop
            preload="metadata"
            playsInline
            onCanPlay={() => setIsAudioReady(true)}
            onCanPlayThrough={() => setIsAudioReady(true)}
            onLoadedMetadata={() => setIsAudioReady(true)}
          />
          {children}
          {showAudioUnlockHint ? (
            <div className="fixed bottom-20 right-5 z-[9999] w-[min(92vw,320px)] rounded-2xl border border-[#00D1FF]/40 bg-[#0B001A]/88 p-3 text-[#d7f7ff] shadow-[0_0_24px_rgba(0,209,255,0.2)] backdrop-blur-sm">
              <p className="text-sm leading-snug">
                Браузер заблокировал автозапуск музыки. Нажмите, чтобы включить звук.
              </p>
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleEnableAudio}
                  className="inline-flex items-center justify-center rounded-xl border border-[#00D1FF]/55 bg-[#102040] px-3 py-1.5 text-xs font-semibold text-[#baf3ff] transition hover:bg-[#17325f]"
                >
                  Включить звук
                </button>
                <button
                  type="button"
                  onClick={() => setIsAudioHintDismissed(true)}
                  className="inline-flex items-center justify-center rounded-xl border border-[#6b7280]/50 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-white/5"
                >
                  Скрыть
                </button>
              </div>
            </div>
          ) : null}
          {!isCabinetRoute && isAudioReady && (
            <button
              type="button"
              onClick={handleAudioToggle}
              className="fixed bottom-5 right-5 z-[9999] inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-[#00D1FF]/50 bg-[#0B001A]/80 text-[#baf3ff] shadow-[0_0_18px_rgba(0,209,255,0.24)] backdrop-blur-sm transition hover:bg-[#12012a]"
              aria-label={isMuted ? 'Включить музыку' : 'Выключить музыку'}
              title={isMuted ? 'Включить музыку' : 'Выключить музыку'}
              data-audio-error={lastAudioError || undefined}
            >
              {isMuted ? (
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M4 9H8L13 5V19L8 15H4V9Z"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinejoin="round"
                  />
                  <path d="M3 3L21 21" stroke="currentColor" strokeWidth="1.8" />
                </svg>
              ) : (
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M4 9H8L13 5V19L8 15H4V9Z"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M16 9C17.3 10.3 17.3 13.7 16 15"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                  <path
                    d="M18.5 6.5C21.2 9.2 21.2 14.8 18.5 17.5"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              )}
            </button>
          )}
        </JotaiProvider>
      </SnackbarProvider>
    </SessionProvider>
  )
}

AppProviders.propTypes = {
  children: PropTypes.node,
}

AppProviders.defaultProps = {
  children: null,
}
