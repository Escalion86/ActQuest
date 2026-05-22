import { NextResponse } from 'next/server'

const FALLBACK_FILE_NAME = 'actquest-file'

const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^0\./,
  /^169\.254\./,
  /^\[?::1\]?$/i,
]

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
  if (!normalized) return true
  return PRIVATE_HOST_PATTERNS.some((pattern) => pattern.test(normalized))
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

    return new Response(upstreamResponse.body, {
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
