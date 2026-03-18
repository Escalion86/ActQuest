import Head from 'next/head'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { SessionProvider } from 'next-auth/react'
import { Provider as JotaiProvider } from 'jotai'
import { SnackbarProvider } from 'lib/notistack'

import '../styles/global.css'

function MyApp({ Component, pageProps: { session, ...pageProps } }) {
  const router = useRouter()
  const mode = process.env.MODE ?? process.env.NODE_ENV
  const audioRef = useRef(null)
  const [isMuted, setIsMuted] = useState(false)
  const [hasStartedPlayback, setHasStartedPlayback] = useState(false)
  const [isAudioReady, setIsAudioReady] = useState(false)
  const isCabinetRoute = router.pathname.startsWith('/cabinet')
  const isLandingRoute = router.pathname === '/' || router.pathname === '/index2'

  const tryPlayAudio = async () => {
    const audio = audioRef.current
    if (!audio || isMuted || isCabinetRoute) return false

    try {
      await audio.play()
      setHasStartedPlayback(true)
      return true
    } catch {
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
            this
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

    if (typeof window === 'undefined') {
      return
    }

    if (mode === 'production' && 'serviceWorker' in navigator) {
      const register = async () => {
        try {
          await navigator.serviceWorker.register('/sw.js')
        } catch (error) {
          console.error('Service worker registration failed:', error)
        }
      }

      register()
    }
  }, [mode])

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
  }, [router.pathname, isLandingRoute, isCabinetRoute, isMuted, hasStartedPlayback])

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
  }, [router.pathname])

  return (
    <>
      <Head>
        <meta charSet="utf-8" />
        <meta httpEquiv="Content-Type" content="text/html; charset=utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <SessionProvider session={session} refetchInterval={5 * 60}>
        <SnackbarProvider
          maxSnack={4}
          autoHideDuration={4000}
          anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
          <JotaiProvider>
            <audio
              ref={audioRef}
              src="/sounds/Cibircatacombs.mp3"
              loop
              preload="auto"
              onCanPlay={() => setIsAudioReady(true)}
              onCanPlayThrough={() => setIsAudioReady(true)}
              onLoadedMetadata={() => setIsAudioReady(true)}
            />
            <Component {...pageProps} />
            {!isCabinetRoute && isAudioReady && (
              <button
                type="button"
                onClick={handleAudioToggle}
                className="fixed bottom-5 right-5 z-[9999] inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-[#00D1FF]/50 bg-[#0B001A]/80 text-[#baf3ff] shadow-[0_0_18px_rgba(0,209,255,0.24)] backdrop-blur-sm transition hover:bg-[#12012a]"
                aria-label={isMuted ? 'Включить музыку' : 'Выключить музыку'}
                title={isMuted ? 'Включить музыку' : 'Выключить музыку'}
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
    </>
  )
}

export default MyApp

// export async function getServerSideProps(ctx) {
//   const session = await getSession(ctx)
//   console.log(`session!!`, session)
//   return {
//     props: {
//       session,
//     },
//   }
// }
