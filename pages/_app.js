import Head from 'next/head'
import { useEffect } from 'react'
import { SessionProvider } from 'next-auth/react'
import { Provider as JotaiProvider } from 'jotai'

import '../styles/global.css'

function MyApp({ Component, pageProps: { session, ...pageProps } }) {
  const mode = process.env.MODE ?? process.env.NODE_ENV

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

  return (
    <>
      <Head>
        <meta charSet="utf-8" />
        <meta httpEquiv="Content-Type" content="text/html; charset=utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <SessionProvider session={session} refetchInterval={5 * 60}>
        <JotaiProvider>
          <Component {...pageProps} />
        </JotaiProvider>
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
