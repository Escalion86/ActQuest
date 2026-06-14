import './globals.css'
import { cookies } from 'next/headers'
import { Roboto } from 'next/font/google'
import AppProviders from './providers'
import ThemeInitializerClient from './ThemeInitializerClient'
import PwaStandalonePullToRefresh from '@components/PwaStandalonePullToRefresh'
import ClientRuntimeScripts from '@components/ClientRuntimeScripts'
import getSiteUrl from '@helpers/getSiteUrl'

const roboto = Roboto({
  subsets: ['latin', 'cyrillic'],
  weight: ['300', '400', '500', '700'],
  display: 'swap',
})

const siteUrl = getSiteUrl()
const THEME_COOKIE_NAME = 'cabinet-theme'

const normalizeTheme = (value) =>
  value === 'dark' || value === 'light' ? value : 'light'

const CLIENT_DIAGNOSTICS_SCRIPT = `
(function () {
  if (window.__AQ_CLIENT_DIAGNOSTICS_INSTALLED__) return;
  window.__AQ_CLIENT_DIAGNOSTICS_INSTALLED__ = true;
  window.__AQ_HYDRATED__ = false;

  var endpoint = "/api/public/client-diagnostics";
  var sent = {};

  function safeString(value, maxLength) {
    if (typeof value !== "string") return "";
    return value.slice(0, maxLength || 1000);
  }

  function getDiagnostics() {
    var nav = window.navigator || {};
    var screenInfo = window.screen || {};
    var swController = null;
    try {
      swController =
        nav.serviceWorker && nav.serviceWorker.controller
          ? {
              scriptURL: safeString(nav.serviceWorker.controller.scriptURL || "", 1000),
              state: safeString(nav.serviceWorker.controller.state || "", 100),
            }
          : null;
    } catch (error) {
      swController = { error: safeString(error && error.message, 300) };
    }

    return {
      path: safeString(window.location && window.location.pathname, 500),
      search: safeString(window.location && window.location.search, 500),
      userAgent: safeString(nav.userAgent || "", 1200),
      platform: safeString(nav.platform || "", 200),
      vendor: safeString(nav.vendor || "", 200),
      language: safeString(nav.language || "", 100),
      languages: Array.prototype.slice.call(nav.languages || [], 0, 10),
      cookieEnabled: nav.cookieEnabled === true,
      onLine: nav.onLine === true,
      standalone:
        window.matchMedia &&
        window.matchMedia("(display-mode: standalone)").matches === true,
      iosStandalone: nav.standalone === true,
      viewport: {
        width: window.innerWidth || null,
        height: window.innerHeight || null,
        devicePixelRatio: window.devicePixelRatio || null,
      },
      screen: {
        width: screenInfo.width || null,
        height: screenInfo.height || null,
      },
      connection: nav.connection
        ? {
            effectiveType: safeString(nav.connection.effectiveType || "", 100),
            downlink: nav.connection.downlink || null,
            rtt: nav.connection.rtt || null,
            saveData: nav.connection.saveData === true,
          }
        : null,
      serviceWorker: {
        supported: Boolean(nav.serviceWorker),
        controlled: Boolean(swController),
        controller: swController,
      },
      readyState: safeString(document.readyState || "", 100),
      timeOrigin: window.performance && window.performance.timeOrigin
        ? window.performance.timeOrigin
        : null,
      now: Date.now(),
    };
  }

  function send(payload) {
    try {
      var key = [
        payload.kind || "",
        payload.message || "",
        payload.filename || "",
        payload.lineno || "",
        payload.colno || "",
      ].join("|");
      if (sent[key]) return;
      sent[key] = true;

      payload.href = safeString(window.location && window.location.href, 1200);
      payload.userAgent = safeString(navigator.userAgent || "", 1200);
      payload.diagnostics = getDiagnostics();

      var body = JSON.stringify(payload);
      if (navigator.sendBeacon) {
        var blob = new Blob([body], { type: "application/json" });
        if (navigator.sendBeacon(endpoint, blob)) return;
      }

      fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body,
        keepalive: true,
      }).catch(function () {});
    } catch (error) {}
  }

  window.__AQ_REPORT_CLIENT_DIAGNOSTIC__ = send;

  window.addEventListener("error", function (event) {
    send({
      kind: "window_error",
      message: safeString(event.message || "Script error", 500),
      filename: safeString(event.filename || "", 1000),
      lineno: event.lineno || null,
      colno: event.colno || null,
      stack: safeString(event.error && event.error.stack, 4000),
    });
  });

  window.addEventListener("unhandledrejection", function (event) {
    var reason = event.reason || {};
    send({
      kind: "unhandled_rejection",
      message: safeString(reason.message || String(reason), 500),
      stack: safeString(reason.stack || "", 4000),
    });
  });

  window.setTimeout(function () {
    if (window.__AQ_HYDRATED__) return;
    send({
      kind: "hydration_timeout",
      message: "React app did not mark hydration within 8 seconds",
    });
  }, 8000);
})();
`

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
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#111827',
}

export default async function RootLayout({ children }) {
  const cookieStore = await cookies()
  const initialTheme = normalizeTheme(cookieStore.get(THEME_COOKIE_NAME)?.value)
  const yandexMetrikaId = Number(process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID)
  const gaMeasurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || ''
  const hasYandexMetrika =
    Number.isFinite(yandexMetrikaId) && yandexMetrikaId > 0
  const hasGa4 =
    typeof gaMeasurementId === 'string' && gaMeasurementId.trim().length > 0

  return (
    <html
      lang="ru"
      className={`${roboto.className} scroll-smooth ${
        initialTheme === 'dark' ? 'dark' : ''
      }`}
      data-theme={initialTheme}
      data-scroll-behavior="smooth"
      style={{ colorScheme: initialTheme }}
      suppressHydrationWarning
    >
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
        <ClientRuntimeScripts
          diagnosticsScript={CLIENT_DIAGNOSTICS_SCRIPT}
          yandexMetrikaId={hasYandexMetrika ? yandexMetrikaId : 0}
          gaMeasurementId={hasGa4 ? gaMeasurementId : ''}
        />
        <ThemeInitializerClient />
        <PwaStandalonePullToRefresh />
        <AppProviders initialTheme={initialTheme}>{children}</AppProviders>
      </body>
    </html>
  )
}
