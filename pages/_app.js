import Head from 'next/head'
import { useEffect } from 'react'
import { SessionProvider } from 'next-auth/react'
import { RecoilRoot, RecoilEnv } from 'recoil'

import Script from 'next/script'

import '../styles/global.css'

RecoilEnv.RECOIL_DUPLICATE_ATOM_KEY_CHECKING_ENABLED = false

function MyApp({ Component, pageProps: { session, ...pageProps } }) {
  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    if (process.env.MODE === 'production' && 'serviceWorker' in navigator) {
      const register = async () => {
        try {
          await navigator.serviceWorker.register('/sw.js')
        } catch (error) {
          console.error('Service worker registration failed:', error)
        }
      }

      register()
    }
  }, [])

  return (
    <>
      <Head>
        <meta charSet="utf-8" />
        <meta httpEquiv="Content-Type" content="text/html; charset=utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <SessionProvider session={session} refetchInterval={5 * 60}>
        <RecoilRoot>
          <Script
            src="https://polyfill.io/v3/polyfill.min.js?features=IntersectionObserver"
            strategy="beforeInteractive"
          />
          <Component {...pageProps} />
        </RecoilRoot>
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
