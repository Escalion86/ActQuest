const CACHE_NAME = 'actquest-cache-v5'
const PRECACHE_URLS = [
  '/favicon.ico',
  '/manifest.json',
  '/icons/pwa-icon-192.png',
  '/icons/pwa-icon-512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(cacheNames.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))),
      ),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const { request } = event

  if (request.method !== 'GET') {
    return
  }

  const requestURL = new URL(request.url)
  const isSameOrigin = requestURL.origin === self.location.origin
  const isAuthRequest = requestURL.pathname.startsWith('/api/auth/')
  const isApiRequest = requestURL.pathname.startsWith('/api/')
  const isNextAssetRequest = requestURL.pathname.startsWith('/_next/')
  const acceptHeader = request.headers.get('accept') || ''
  const isRscRequest =
    requestURL.searchParams.has('_rsc') ||
    acceptHeader.includes('text/x-component')
  const isAudioRequest =
    requestURL.pathname.startsWith('/sounds/') ||
    (request.headers.get('accept') || '').includes('audio/')
  const hasRangeHeader = request.headers.has('range')
  const isHtmlRequest =
    request.mode === 'navigate' || acceptHeader.includes('text/html')
  const cacheControl = request.headers.get('cache-control') || ''
  const shouldBypassCacheControl =
    cacheControl.includes('no-store') || request.cache === 'no-store'

  if (
    !isSameOrigin ||
    isAuthRequest ||
    isRscRequest ||
    shouldBypassCacheControl
  ) {
    return
  }

  // Do not intercept byte-range requests. Browsers often use them for media streaming,
  // and cache-matching a full response may break seek/start behavior.
  if (hasRangeHeader) {
    return
  }

  if (isApiRequest) {
    return
  }

  if (isNextAssetRequest) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone()
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache)
            })
          }
          return networkResponse
        })
        .catch(async () => {
          const cached = await caches.match(request)
          if (cached) return cached
          return new Response('', { status: 504, statusText: 'Gateway Timeout' })
        }),
    )
    return
  }

  if (isAudioRequest) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone()
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache)
            })
          }
          return networkResponse
        })
        .catch(async () => {
          const cached = await caches.match(request)
          if (cached) return cached
          return new Response('', { status: 504, statusText: 'Gateway Timeout' })
        }),
    )
    return
  }

  if (isHtmlRequest) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse) {
            return networkResponse
          }

          return new Response('Offline', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          })
        })
        .catch(
          () =>
            new Response('Offline', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: { 'Content-Type': 'text/plain; charset=utf-8' },
            }),
        ),
    )
    return
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse
      }

      return fetch(request)
        .then((networkResponse) => {
          const shouldCache =
            networkResponse &&
            networkResponse.status === 200 &&
            isSameOrigin
          const responseContentType =
            networkResponse.headers.get('content-type') || ''
          const isHtmlResponse = responseContentType.includes('text/html')

          if (shouldCache && !isHtmlResponse) {
            const responseToCache = networkResponse.clone()
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache)
            })
          }

          return networkResponse
        })
        .catch(() => {
          if (cachedResponse) return cachedResponse
          return new Response('', { status: 504, statusText: 'Gateway Timeout' })
        })
    }),
  )
})

const DEFAULT_NOTIFICATION_ICON = '/icons/pwa-icon-192.png'

self.addEventListener('push', (event) => {
  if (!event.data) {
    return
  }

  let payload

  try {
    payload = event.data.json()
  } catch (error) {
    payload = { body: event.data.text() }
  }

  const title = payload?.title || 'ActQuest'
  const body = payload?.body || ''
  const data = payload?.data || {}
  const tag = payload?.tag

  const options = {
    body,
    data,
    tag,
    icon: payload?.icon || DEFAULT_NOTIFICATION_ICON,
    badge: payload?.badge || DEFAULT_NOTIFICATION_ICON,
    vibrate: payload?.vibrate || [150, 75, 150],
    renotify: Boolean(tag),
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const targetUrl = event.notification?.data?.url || '/cabinet?tab=notifications'

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if (!client.url) continue

          const normalizedUrl = new URL(client.url, self.location.origin)

          if (client.focus && normalizedUrl.href.includes('/cabinet')) {
            client.focus()
            if (typeof client.postMessage === 'function') {
              client.postMessage({
                type: 'notification-click',
                data: event.notification?.data || {},
              })
            }
            return
          }
        }

        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl)
        }
        return null
      })
  )
})
