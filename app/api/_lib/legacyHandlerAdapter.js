import { NextResponse } from 'next/server'

const buildQueryObject = (searchParams) => {
  const result = {}
  if (!searchParams || typeof searchParams[Symbol.iterator] !== 'function') {
    return result
  }

  for (const [key, value] of searchParams.entries()) {
    if (Object.prototype.hasOwnProperty.call(result, key)) {
      const prev = result[key]
      result[key] = Array.isArray(prev) ? [...prev, value] : [prev, value]
    } else {
      result[key] = value
    }
  }

  return result
}

const buildHeadersObject = (headers) => {
  const result = {}
  if (!headers || typeof headers.forEach !== 'function') {
    return result
  }

  headers.forEach((value, key) => {
    result[key] = value
  })

  return result
}

const parseBody = async (request) => {
  if (!request || request.method === 'GET' || request.method === 'HEAD') {
    return undefined
  }

  const contentType = String(request.headers.get('content-type') || '')
  if (contentType.includes('application/json')) {
    return request.json().catch(() => ({}))
  }

  return undefined
}

export const runLegacyHandler = async ({
  request,
  handler,
  defaultStatus = 200,
  defaultJson = { success: true },
}) => {
  const req = {
    method: request.method,
    query: buildQueryObject(request.nextUrl?.searchParams),
    headers: buildHeadersObject(request.headers),
    body: await parseBody(request),
  }

  const state = {
    statusCode: 200,
    headers: {},
    sentType: null,
    payload: null,
  }

  const res = {
    setHeader(name, value) {
      state.headers[name] = value
    },
    status(code) {
      state.statusCode = Number(code) || 200
      return this
    },
    json(payload) {
      state.sentType = 'json'
      state.payload = payload
      return this
    },
    send(payload) {
      state.sentType = 'send'
      state.payload = payload
      return this
    },
  }

  await handler(req, res)

  const responseHeaders = new Headers()
  Object.entries(state.headers).forEach(([key, value]) => {
    if (typeof value === 'undefined' || value === null) return
    responseHeaders.set(key, Array.isArray(value) ? value.join(', ') : String(value))
  })

  if (state.sentType === 'json') {
    return NextResponse.json(state.payload, {
      status: state.statusCode,
      headers: responseHeaders,
    })
  }

  if (state.sentType === 'send') {
    return new NextResponse(String(state.payload ?? ''), {
      status: state.statusCode,
      headers: responseHeaders,
    })
  }

  return NextResponse.json(defaultJson, {
    status: defaultStatus,
    headers: responseHeaders,
  })
}
