export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).json({ success: false, error: 'Метод не поддерживается' })
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  return res.status(200).send(`<!doctype html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>VK ID Callback</title>
  </head>
  <body>
    <script>
      (function () {
        try {
          var params = new URLSearchParams(window.location.search || '')
          var payload = {}

          params.forEach(function (value, key) {
            payload[key] = value
          })

          if (window.opener && !window.opener.closed) {
            var state = payload.state || ''
            var action = 'oauth2_authorize_response' + state
            window.opener.postMessage(
              {
                action: action,
                payload: payload,
              },
              window.location.origin,
            )

            window.close()
            return
          }
        } catch (error) {}
        var query = window.location.search || ''
        window.location.replace('/cabinet/login' + query)
      })()
    </script>
  </body>
</html>`)
}
