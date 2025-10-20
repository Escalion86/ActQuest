export const decodeCallbackParam = (rawValue) => {
  if (!rawValue) return null

  const value = Array.isArray(rawValue) ? rawValue[0] : rawValue
  if (typeof value !== 'string' || !value) return null

  let decoded = value

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const nextDecoded = decodeURIComponent(decoded)
      if (nextDecoded === decoded) break
      decoded = nextDecoded
    } catch (error) {
      break
    }
  }

  return decoded
}

export const extractRelativePath = (url, baseOrigin) => {
  if (!url) return null

  if (typeof url === 'string' && url.startsWith('/')) {
    return url
  }

  if (!baseOrigin) return null

  try {
    const parsed = new URL(url, baseOrigin)
    const base = new URL(baseOrigin)

    if (parsed.origin !== base.origin) {
      return null
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}` || '/'
  } catch (error) {
    return null
  }
}

export const getRequestOrigin = (req) => {
  if (!req?.headers) return null

  const forwardedProto = req.headers['x-forwarded-proto']
  const forwardedHost = req.headers['x-forwarded-host']
  const hostHeader = req.headers.host

  const rawProtocol = Array.isArray(forwardedProto)
    ? forwardedProto[0]
    : typeof forwardedProto === 'string'
    ? forwardedProto.split(',')[0]?.trim()
    : null

  const protocol =
    rawProtocol ||
    (hostHeader?.startsWith('localhost') || hostHeader?.startsWith('127.0.0.1')
      ? 'http'
      : 'https')

  const rawHost = Array.isArray(forwardedHost)
    ? forwardedHost[0]
    : typeof forwardedHost === 'string'
    ? forwardedHost.split(',')[0]?.trim()
    : null

  const host = rawHost || hostHeader

  if (!host) return null

  return `${protocol}://${host}`
}

export const isSafeCabinetRedirect = (relativePath) => {
  if (typeof relativePath !== 'string') {
    return false
  }

  const trimmed = relativePath.trim()

  if (!trimmed || trimmed === '/' || trimmed === '/cabinet') {
    return false
  }

  if (trimmed.startsWith('/cabinet/login') || trimmed.startsWith('/api/auth')) {
    return false
  }

  return true
}

export const resolveCabinetCallback = (rawCallback, req) => {
  const decodedCallback = decodeCallbackParam(rawCallback)
  const requestOrigin = getRequestOrigin(req)
  const relativeCallback = extractRelativePath(decodedCallback, requestOrigin)
  const safe = isSafeCabinetRedirect(relativeCallback)

  return {
    decodedCallback,
    relativeCallback,
    isSafe: safe,
  }
}
