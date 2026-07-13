import { NextResponse } from 'next/server'

const FALLBACK_FILE_NAME = 'actquest-file'
const MAX_DOWNLOAD_BYTES = 60 * 1024 * 1024
const DOWNLOAD_TIMEOUT_MS = 20_000

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
          controller.error(new Error('Remote media is too large'))
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
      { success: false, error: 'Не указан URL файла' },
      { status: 400 },
    )
  }

  let mediaUrl
  try {
    mediaUrl = new URL(rawUrl, request.nextUrl.origin)
  } catch {
    return NextResponse.json(
      { success: false, error: 'Некорректный URL файла' },
      { status: 400 },
    )
  }

  if (!['http:', 'https:'].includes(mediaUrl.protocol)) {
    return NextResponse.json(
      { success: false, error: 'Неподдерживаемый URL файла' },
      { status: 400 },
    )
  }

  if (isBlockedHost(mediaUrl.hostname)) {
    return NextResponse.json(
      { success: false, error: 'URL файла запрещен' },
      { status: 400 },
    )
  }

  try {
    const upstreamResponse = await fetch(mediaUrl, {
      headers: {
        Accept: '*/*',
      },
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
    })

    if (!upstreamResponse.ok || !upstreamResponse.body) {
      return NextResponse.json(
        { success: false, error: 'Не удалось получить файл' },
        { status: upstreamResponse.status || 502 },
      )
    }

    const requestedFileName = request.nextUrl.searchParams.get('filename')
    const fileName = sanitizeFileName(requestedFileName || getFileNameFromUrl(mediaUrl))
    const contentType =
      upstreamResponse.headers.get('content-type') || 'application/octet-stream'
    const contentLengthNumber = Number(
      upstreamResponse.headers.get('content-length'),
    )
    if (
      Number.isFinite(contentLengthNumber) &&
      contentLengthNumber > MAX_DOWNLOAD_BYTES
    ) {
      return NextResponse.json(
        { success: false, error: 'Файл слишком большой' },
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
    console.error('Media download proxy error:', error)
    return NextResponse.json(
      { success: false, error: 'Не удалось скачать файл' },
      { status: 502 },
    )
  }
}
