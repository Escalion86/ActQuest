import { NextResponse } from 'next/server'

import { resolveGameLocationById } from '@app/api/cabinet/_lib/resolveGameLocation'

const copyContentType = (sourceHeaders) => {
  const value =
    sourceHeaders?.get?.('content-type') ||
    sourceHeaders?.get?.('Content-Type') ||
    'application/json'
  return value
}

export const proxyToLocationGameRoute = async ({
  request,
  gameId,
  targetPath,
  method = 'GET',
  bodyText = null,
}) => {
  const resolved = await resolveGameLocationById(gameId)
  if (resolved.error || !resolved.location || !resolved.gameId) {
    return NextResponse.json(
      { success: false, error: resolved.error || 'Не удалось определить площадку игры' },
      { status: resolved.status || 400 },
    )
  }

  const resolvedTargetPath = String(targetPath || '')
    .replaceAll(':location', encodeURIComponent(resolved.location))
    .replaceAll(':gameId', encodeURIComponent(resolved.gameId))

  const targetUrl = new URL(resolvedTargetPath, request.nextUrl.origin)

  const headers = new Headers()
  headers.set('content-type', copyContentType(request.headers))
  const cookie = request.headers.get('cookie')
  if (cookie) {
    headers.set('cookie', cookie)
  }

  const response = await fetch(targetUrl, {
    method,
    headers,
    body: bodyText,
    cache: 'no-store',
  })

  const contentType = response.headers.get('content-type') || 'application/json'
  const payload = await response.text()

  return new NextResponse(payload, {
    status: response.status,
    headers: { 'content-type': contentType },
  })
}
