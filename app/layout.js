import './globals.css'
import { Roboto } from 'next/font/google'
import Script from 'next/script'
import AppProviders from './providers'
import ThemeInitializerClient from './ThemeInitializerClient'
import PwaStandalonePullToRefresh from '@components/PwaStandalonePullToRefresh'

const roboto = Roboto({
  subsets: ['latin', 'cyrillic'],
  weight: ['300', '400', '500', '700'],
  display: 'swap',
})

const siteUrl =
  process.env.NEXTAUTH_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  'https://actquest.ru'

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'ActQuest — городские автоквесты',
    template: '%s | ActQuest',
  },
  description:
    'Командные автоквесты по городу: разгадывайте загадки, ищите коды, соревнуйтесь с друзьями. Красноярск, Норильск, Екатеринбург.',
  applicationName: 'ActQuest',
  manifest: '/manifest.json',
  openGraph: {
    type: 'website',
    siteName: 'ActQuest',
    title: 'ActQuest — городские автоквесты',
    description:
      'Командные автоквесты по городу: разгадывайте загадки, ищите коды, соревнуйтесь с друзьями.',
    url: siteUrl,
    images: [
      {
        url: '/logo_title.png',
        width: 1024,
        height: 1024,
        alt: 'ActQuest',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ActQuest — городские автоквесты',
    description:
      'Командные автоквесты по городу: разгадывайте загадки, ищите коды, соревнуйтесь с друзьями.',
    images: ['/logo_title.png'],
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/icons/pwa-icon-192.png',
  },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#111827',
}

export default function RootLayout({ children }) {
  const yandexMetrikaId = Number(process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID)
  const gaMeasurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || ''
  const hasYandexMetrika = Number.isFinite(yandexMetrikaId) && yandexMetrikaId > 0
  const hasGa4 = typeof gaMeasurementId === 'string' && gaMeasurementId.trim().length > 0

  return (
    <html
      lang="ru"
      className={`${roboto.className} scroll-smooth`}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        {hasYandexMetrika ? (
          <Script id="aq-yandex-metrika-init" strategy="afterInteractive">
            {`
              (function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
              m[i].l=1*new Date();
              for (var j = 0; j < document.scripts.length; j++) { if (document.scripts[j].src === r) { return; } }
              k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})
              (window, document, "script", "https://mc.yandex.ru/metrika/tag.js?id=${yandexMetrikaId}", "ym");
              window.__AQ_YM_ID = ${yandexMetrikaId};
              ym(${yandexMetrikaId}, "init", {
                ssr:true,
                webvisor:true,
                clickmap:true,
                trackLinks:true,
                accurateTrackBounce:true,
                ecommerce:"dataLayer",
                referrer: document.referrer,
                url: location.href
              });
            `}
          </Script>
        ) : null}
        {hasGa4 ? (
          <>
            <Script
              id="aq-ga4-loader"
              src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaMeasurementId)}`}
              strategy="afterInteractive"
            />
            <Script id="aq-ga4-init" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                window.gtag = window.gtag || gtag;
                window.__AQ_GA_ID = "${gaMeasurementId}";
                gtag('js', new Date());
                gtag('config', "${gaMeasurementId}", {
                  send_page_view: true
                });
              `}
            </Script>
          </>
        ) : null}
      </head>
      <body>
        {hasYandexMetrika ? (
          <noscript>
            <div>
              <img
                src={`https://mc.yandex.ru/watch/${yandexMetrikaId}`}
                style={{ position: 'absolute', left: '-9999px' }}
                alt=""
              />
            </div>
          </noscript>
        ) : null}
        <ThemeInitializerClient />
        <PwaStandalonePullToRefresh />
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  )
}
