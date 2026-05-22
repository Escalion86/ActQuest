import { NextResponse } from 'next/server'

const FALLBACK_FILE_NAME = 'actquest-image'

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
    console.error('Image download proxy error:', error)
    return NextResponse.json(
      { success: false, error: 'Не удалось скачать изображение' },
      { status: 502 },
    )
  }
}
