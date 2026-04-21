const DEFAULT_SITE_URL = 'https://actquest.ru'

const normalizeSiteUrl = (value) => {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`

  try {
    const parsed = new URL(withProtocol)

    let pathname = (parsed.pathname || '/').trim()
    if (!pathname.startsWith('/')) {
      pathname = `/${pathname}`
    }
    pathname = pathname.replace(/\/+$/, '')
    if (pathname === '/api/auth') {
      pathname = ''
    }

    const normalizedPath = pathname ? pathname : ''
    return `${parsed.protocol}//${parsed.host}${normalizedPath}`
  } catch {
    return null
  }
}

const getSiteUrl = () => {
  const fromPublic = normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL)
  if (fromPublic) {
    return fromPublic
  }

  const fromNextAuth = normalizeSiteUrl(process.env.NEXTAUTH_URL)
  if (fromNextAuth) {
    return fromNextAuth
  }

  return DEFAULT_SITE_URL
}

export default getSiteUrl
