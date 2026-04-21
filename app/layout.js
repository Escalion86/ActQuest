import './globals.css'
import { Roboto } from 'next/font/google'
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
      </head>
      <body>
        <ThemeInitializerClient />
        <PwaStandalonePullToRefresh />
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  )
}
