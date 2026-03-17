import { getSession } from 'next-auth/react'
import { getToken } from 'next-auth/jwt'

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
  const req = context?.req || context
  try {
    const session = await getSession(buildSessionContext(context))
    if (session) {
      return session
    }
  } catch (error) {
    console.error('Не удалось получить сессию пользователя', error)
  }

  // Fallback: when SSR getSession intermittently returns null,
  // decode JWT token directly from cookies.
  try {
    if (req) {
      const token = await getToken({
        req,
        secret: process.env.SECRET,
      })

      if (token) {
        return {
          user: {
            _id: token.globalUserId ?? token.userId ?? null,
            globalUserId: token.globalUserId ?? token.userId ?? null,
            telegramId: token.telegramId ?? null,
            vkId: token.vkId ?? null,
            phone: token.phone ?? null,
            authMethod: token.authMethod ?? 'telegram',
            location: token.location ?? null,
            name: token.name ?? null,
            username: token.username ?? null,
            photoUrl: token.photoUrl ?? null,
            languageCode: token.languageCode ?? null,
            isPremium: Boolean(token.isPremium),
            isTestAuth: Boolean(token.isTestAuth),
            role: token.role ?? 'client',
          },
          expires: token.exp
            ? new Date(Number(token.exp) * 1000).toISOString()
            : new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        }
      }
    }
  } catch (tokenError) {
    console.error('Не удалось декодировать JWT токен пользователя', tokenError)
  }

  clearAuthCookies(context?.res)
  return null
}

export default getSessionSafe
