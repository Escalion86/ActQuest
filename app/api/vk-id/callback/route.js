import { NextResponse } from 'next/server'

const CALLBACK_HTML = `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>VK ID Callback</title>
  </head>
  <body>
    <script>
      (function () {
        window.close()
      })()
    </script>
  </body>
</html>`

export async function GET() {
  return new NextResponse(CALLBACK_HTML, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}
