const CACHE_NAME = 'actquest-cache-v1'
const PRECACHE_URLS = [
  '/',
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
  if (event.request.method !== 'GET') {
    return
  }

  const requestURL = new URL(event.request.url)

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse
      }

      return fetch(event.request)
        .then((networkResponse) => {
          const shouldCache = networkResponse && networkResponse.status === 200 && requestURL.origin === self.location.origin

          if (shouldCache) {
            const responseToCache = networkResponse.clone()
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache)
            })
          }

          return networkResponse
        })
        .catch(() => cachedResponse)
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
