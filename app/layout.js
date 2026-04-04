import './globals.css'
import AppProviders from './providers'
import ThemeInitializerClient from './ThemeInitializerClient'

const siteUrl =
  process.env.NEXTAUTH_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  'https://actquest.ru'

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'ActQuest',
    template: '%s',
  },
  description: 'ActQuest — платформа для городских автоквестов.',
  applicationName: 'ActQuest',
  manifest: '/manifest.json',
  openGraph: {
    type: 'website',
    siteName: 'ActQuest',
    title: 'ActQuest',
    description: 'ActQuest — платформа для городских автоквестов.',
    url: siteUrl,
  },
  twitter: {
    card: 'summary',
    title: 'ActQuest',
    description: 'ActQuest — платформа для городских автоквестов.',
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/icons/pwa-icon-192.png',
  },
}

export const viewport = {
  themeColor: '#111827',
}

export default function RootLayout({ children }) {
  return (
    <html
      lang="ru"
      className="scroll-smooth"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css?family=Roboto:300,400,500,700&display=swap"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/icon?family=Material+Icons"
        />
        <link
          href="https://cdn.jsdelivr.net/npm/@tailwindcss/custom-forms@0.2.1/dist/custom-forms.css"
          rel="stylesheet"
        />
      </head>
      <body>
        <ThemeInitializerClient />
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  )
}
