import { getSession } from 'next-auth/react'

const AUTH_COOKIE_NAMES = ['next-auth.session-token', '__Secure-next-auth.session-token']

const clearAuthCookies = (res) => {
  if (!res || typeof res.getHeader !== 'function' || typeof res.setHeader !== 'function') {
    return
  }

  const existingCookies = res.getHeader('Set-Cookie')
  const normalizedExisting = existingCookies
    ? Array.isArray(existingCookies)
      ? existingCookies
      : [existingCookies]
    : []

  const expiredCookies = AUTH_COOKIE_NAMES.map(
    (name) => `${name}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax`
  )

  res.setHeader('Set-Cookie', [...normalizedExisting, ...expiredCookies])
}

const buildSessionContext = (context) => {
  if (!context) {
    return undefined
  }

  if (context.req) {
    return { req: context.req }
  }

  return context
}

const getSessionSafe = async (context) => {
  try {
    return await getSession(buildSessionContext(context))
  } catch (error) {
    console.error('Не удалось получить сессию пользователя', error)
    clearAuthCookies(context?.res)
    return null
  }
}

export default getSessionSafe
