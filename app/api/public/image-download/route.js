import { NextResponse } from 'next/server'

const FALLBACK_FILE_NAME = 'actquest-image'
const MAX_DOWNLOAD_BYTES = 25 * 1024 * 1024
const DOWNLOAD_TIMEOUT_MS = 15_000

const ALLOWED_REMOTE_HOSTS = new Set(['cloud.escalion.ru'])
const configuredRemoteHosts = String(
  process.env.REMOTE_DOWNLOAD_ALLOWED_HOSTS || '',
)
  .split(',')
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean)
configuredRemoteHosts.forEach((hostname) => ALLOWED_REMOTE_HOSTS.add(hostname))
try {
  const configuredOrigin = process.env.NEXT_PUBLIC_ESCALIONCLOUD_PUBLIC_ORIGIN
  if (configuredOrigin) {
    ALLOWED_REMOTE_HOSTS.add(new URL(configuredOrigin).hostname.toLowerCase())
  }
} catch {
  // Некорректный origin не расширяет allowlist.
}

const sanitizeFileName = (value) => {
  const normalized = String(value || '')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .slice(0, 160)

  return normalized || FALLBACK_FILE_NAME
}

const getFileNameFromUrl = (url) => {
  try {
    const lastPathPart = decodeURIComponent(
      url.pathname.split('/').filter(Boolean).pop() || '',
    )
    return sanitizeFileName(lastPathPart)
  } catch {
    return FALLBACK_FILE_NAME
  }
}

const isBlockedHost = (hostname) => {
  const normalized = String(hostname || '').trim().toLowerCase()
  return !normalized || !ALLOWED_REMOTE_HOSTS.has(normalized)
}

const createLimitedBody = (body) => {
  let receivedBytes = 0
  return body.pipeThrough(
    new TransformStream({
      transform(chunk, controller) {
        receivedBytes += chunk?.byteLength || 0
        if (receivedBytes > MAX_DOWNLOAD_BYTES) {
          controller.error(new Error('Remote image is too large'))
          return
        }
        controller.enqueue(chunk)
      },
    }),
  )
}

const encodeContentDispositionFileName = (fileName) => {
  const fallback = fileName.replace(/[^\x20-\x7E]+/g, '_').replace(/"/g, "'")
  const encoded = encodeURIComponent(fileName).replace(/['()*]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  )
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`
}

export async function GET(request) {
  const rawUrl = request.nextUrl.searchParams.get('url')

  if (!rawUrl) {
    return NextResponse.json(
      { success: false, error: 'Не указан URL изображения' },
      { status: 400 },
    )
  }

  let imageUrl
  try {
    imageUrl = new URL(rawUrl, request.nextUrl.origin)
  } catch {
    return NextResponse.json(
      { success: false, error: 'Некорректный URL изображения' },
      { status: 400 },
    )
  }

  if (!['http:', 'https:'].includes(imageUrl.protocol)) {
    return NextResponse.json(
      { success: false, error: 'Неподдерживаемый URL изображения' },
      { status: 400 },
    )
  }

  if (isBlockedHost(imageUrl.hostname)) {
    return NextResponse.json(
      { success: false, error: 'URL изображения запрещен' },
      { status: 400 },
    )
  }

  try {
    const upstreamResponse = await fetch(imageUrl, {
      headers: {
        Accept: 'image/*,*/*;q=0.8',
      },
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
    })

    if (!upstreamResponse.ok || !upstreamResponse.body) {
      return NextResponse.json(
        { success: false, error: 'Не удалось получить изображение' },
        { status: upstreamResponse.status || 502 },
      )
    }

    const requestedFileName = request.nextUrl.searchParams.get('filename')
    const fileName = sanitizeFileName(requestedFileName || getFileNameFromUrl(imageUrl))
    const contentType =
      upstreamResponse.headers.get('content-type') || 'application/octet-stream'
    if (!contentType.toLowerCase().startsWith('image/')) {
      return NextResponse.json(
        { success: false, error: 'Удалённый ресурс не является изображением' },
        { status: 415 },
      )
    }
    const contentLengthNumber = Number(
      upstreamResponse.headers.get('content-length'),
    )
    if (
      Number.isFinite(contentLengthNumber) &&
      contentLengthNumber > MAX_DOWNLOAD_BYTES
    ) {
      return NextResponse.json(
        { success: false, error: 'Изображение слишком большое' },
        { status: 413 },
      )
    }
    const headers = new Headers({
      'Content-Type': contentType,
      'Content-Disposition': encodeContentDispositionFileName(fileName),
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    })
    const contentLength = upstreamResponse.headers.get('content-length')
    if (contentLength) {
      headers.set('Content-Length', contentLength)
    }

    return new Response(createLimitedBody(upstreamResponse.body), {
      status: 200,
      headers,
    })
  } catch (error) {
    console.error('Image download proxy error:', error)
    return NextResponse.json(
      { success: false, error: 'Не удалось скачать изображение' },
      { status: 502 },
    )
  }
}
