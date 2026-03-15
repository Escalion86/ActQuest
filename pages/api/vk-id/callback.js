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
          if (window.opener && !window.opener.closed) {
            window.close()
            return
          }
        } catch (error) {}
        window.location.replace('/cabinet/login')
      })()
    </script>
  </body>
</html>`)
}
