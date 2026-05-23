const DEFAULT_FALLBACK_PATH = '/cabinet/login'

const escapeForJs = (value) =>
  String(value)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")

const normalizeFallbackPath = (value) => {
  if (typeof value !== 'string') {
    return DEFAULT_FALLBACK_PATH
  }

  const trimmed = value.trim()
  if (!trimmed.startsWith('/')) {
    return DEFAULT_FALLBACK_PATH
  }

  return trimmed
}

const buildVkCallbackHtml = ({
  fallbackPath = DEFAULT_FALLBACK_PATH,
} = {}) => {
  const safeFallbackPath = escapeForJs(normalizeFallbackPath(fallbackPath))

  return `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>VK ID Callback</title>
  </head>
  <body>
    <script>
      (function () {
        var fallbackPath = '${safeFallbackPath}'
        var fallbackUrl = window.location.origin + fallbackPath
        var payload = {
          source: 'actquest-vk-callback',
          href: window.location.href,
          search: window.location.search,
          hash: window.location.hash
        }

        try {
          if (window.opener && !window.opener.closed) {
            window.opener.postMessage(payload, window.location.origin)
          }
        } catch (error) {
          console.error('VK callback postMessage failed', error)
        }

        try {
          if (window.parent && window.parent !== window) {
            window.parent.postMessage(payload, window.location.origin)
          }
        } catch (error) {
          console.error('VK callback parent postMessage failed', error)
        }

        try {
          window.close()
        } catch (error) {
          console.error('VK callback close failed', error)
        }

        window.setTimeout(function () {
          if (!window.closed) {
            window.location.replace(fallbackUrl)
          }
        }, 150)
      })()
    </script>
  </body>
</html>`
}

module.exports = buildVkCallbackHtml
