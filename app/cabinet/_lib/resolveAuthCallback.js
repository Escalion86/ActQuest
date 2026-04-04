import {
  decodeCallbackParam,
  extractRelativePath,
  isSafeCabinetRedirect,
} from '@helpers/cabinetAuth'

const getHeaderValue = (headersList, key) => {
  if (!headersList || typeof headersList.get !== 'function') {
    return null
  }

  const value = headersList.get(key)
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

const resolveRequestOrigin = (headersList) => {
  const forwardedProtoRaw = getHeaderValue(headersList, 'x-forwarded-proto')
  const forwardedHostRaw = getHeaderValue(headersList, 'x-forwarded-host')
  const hostRaw = getHeaderValue(headersList, 'host')

  const forwardedProto = forwardedProtoRaw
    ? forwardedProtoRaw.split(',')[0]?.trim()
    : null
  const forwardedHost = forwardedHostRaw
    ? forwardedHostRaw.split(',')[0]?.trim()
    : null

  const host = forwardedHost || hostRaw
  if (!host) {
    return null
  }

  const protocol =
    forwardedProto ||
    (host.startsWith('localhost') || host.startsWith('127.0.0.1')
      ? 'http'
      : 'https')

  return `${protocol}://${host}`
}

const pickFirst = (value) => (Array.isArray(value) ? value[0] : value)

export const resolveAuthCallbackFromSearchParams = ({
  searchParams,
  headersList,
  fallback = '/cabinet',
}) => {
  const rawCallback = pickFirst(searchParams?.callbackUrl)
  const decodedCallback = decodeCallbackParam(rawCallback)
  const origin = resolveRequestOrigin(headersList)
  const relativeCallback = extractRelativePath(decodedCallback, origin)
  const isSafe = isSafeCabinetRedirect(relativeCallback)

  return {
    authCallbackUrl: isSafe ? relativeCallback : fallback,
    authCallbackSource: decodedCallback || null,
    relativeCallback,
    isSafe,
  }
}
