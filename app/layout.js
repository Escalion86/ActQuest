import './globals.css'
import { Roboto } from 'next/font/google'
import Script from 'next/script'
import AppProviders from './providers'
import ThemeInitializerClient from './ThemeInitializerClient'
import PwaStandalonePullToRefresh from '@components/PwaStandalonePullToRefresh'
import getSiteUrl from '@helpers/getSiteUrl'

const roboto = Roboto({
  subsets: ['latin', 'cyrillic'],
  weight: ['300', '400', '500', '700'],
  display: 'swap',
})

const siteUrl = getSiteUrl()

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
        <Script
          id="aq-client-diagnostics"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: CLIENT_DIAGNOSTICS_SCRIPT }}
        />
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
