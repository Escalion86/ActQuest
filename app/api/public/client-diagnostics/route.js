import { NextResponse } from 'next/server'

import logSiteEvent from '@helpers/logSiteEvent'

const MAX_STRING_LENGTH = 1000
const MAX_METADATA_STRING_LENGTH = 2000
const MAX_STACK_LENGTH = 4000

const normalizeString = (value, maxLength = MAX_STRING_LENGTH) => {
  if (typeof value !== 'string') {
    return ''
  }

  return value.trim().slice(0, maxLength)
}

const normalizeObject = (value, depth = 0) => {
  if (!value || typeof value !== 'object' || depth > 3) {
    return null
  }

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => {
      if (typeof item === 'string') {
        return normalizeString(item, MAX_METADATA_STRING_LENGTH)
      }
      if (typeof item === 'number' || typeof item === 'boolean') {
        return item
      }
      return normalizeObject(item, depth + 1)
    })
  }

  return Object.entries(value)
    .slice(0, 80)
    .reduce((acc, [key, item]) => {
      const safeKey = normalizeString(key, 120)
      if (!safeKey) return acc

      if (typeof item === 'string') {
        acc[safeKey] = normalizeString(item, MAX_METADATA_STRING_LENGTH)
        return acc
      }

      if (typeof item === 'number' || typeof item === 'boolean' || item === null) {
        acc[safeKey] = item
        return acc
      }

      const nested = normalizeObject(item, depth + 1)
      if (nested !== null) {
        acc[safeKey] = nested
      }
      return acc
    }, {})
}

const getRequestIp = (request) => {
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    return normalizeString(forwardedFor.split(',')[0], 120)
  }

  return normalizeString(
    request.headers.get('x-real-ip') || request.headers.get('cf-connecting-ip'),
    120,
  )
}

export async function POST(request) {
  try {
    const body = (await request.json().catch(() => ({}))) || {}
    const kind = normalizeString(body.kind || body.type || 'client_event', 120)
    const message = normalizeString(body.message || kind, 300)
    const href = normalizeString(body.href, 1200)
    const userAgent = normalizeString(
      body.userAgent || request.headers.get('user-agent') || '',
      1200,
    )
    const stack = normalizeString(body.stack, MAX_STACK_LENGTH)
    const diagnostics = normalizeObject(body.diagnostics) || {}

    await logSiteEvent({
      type: 'client_diagnostic',
      message: `[client] ${kind}: ${message}`,
      metadata: {
        kind,
        message,
        href,
        userAgent,
        stack,
        diagnostics,
        request: {
          ip: getRequestIp(request),
          referer: normalizeString(request.headers.get('referer'), 1200),
          acceptLanguage: normalizeString(
            request.headers.get('accept-language'),
            500,
          ),
        },
      },
    })

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('Failed to save client diagnostic', error)
    return NextResponse.json(
      { success: false, error: 'Failed to save diagnostic' },
      { status: 500 },
    )
  }
}
