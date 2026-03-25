import { getSession } from 'next-auth/react'
import { getServerSession } from 'next-auth/next'
import { getToken } from 'next-auth/jwt'
import { authOptions } from '@pages/api/auth/[...nextauth]'

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

const normalizeSessionFromToken = (token) => {
  if (!token) {
    return null
  }

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

const mergeSessionWithToken = (session, token) => {
  if (!session) {
    return normalizeSessionFromToken(token)
  }

  if (!token) {
    return session
  }

  const tokenSession = normalizeSessionFromToken(token)
  const sessionUser = session?.user ?? {}
  const tokenUser = tokenSession?.user ?? {}

  return {
    ...session,
    user: {
      ...tokenUser,
      ...sessionUser,
      _id: sessionUser._id ?? tokenUser._id ?? null,
      globalUserId:
        sessionUser.globalUserId ?? sessionUser._id ?? tokenUser.globalUserId ?? null,
      telegramId: sessionUser.telegramId ?? tokenUser.telegramId ?? null,
      vkId: sessionUser.vkId ?? tokenUser.vkId ?? null,
      phone: sessionUser.phone ?? tokenUser.phone ?? null,
      location: sessionUser.location ?? tokenUser.location ?? null,
      role: sessionUser.role ?? tokenUser.role ?? 'client',
      isTestAuth: Boolean(sessionUser.isTestAuth ?? tokenUser.isTestAuth),
    },
    expires: session.expires ?? tokenSession?.expires ?? null,
  }
}

const getSessionSafe = async (context) => {
  const req = context?.req || context
  let session = null

  try {
    if (context?.req && context?.res) {
      session = await getServerSession(context.req, context.res, authOptions)
    }

    if (!session) {
      session = await getSession(buildSessionContext(context))
    }
  } catch (error) {
    console.error('Не удалось получить сессию пользователя', error)
  }

  let token = null

  // Fallback: when SSR getSession intermittently returns null,
  // decode JWT token directly from cookies.
  try {
    if (req) {
      token = await getToken({
        req,
        secret: process.env.SECRET,
      })
    }
  } catch (tokenError) {
    console.error('Не удалось декодировать JWT токен пользователя', tokenError)
  }

  const resolvedSession = mergeSessionWithToken(session, token)
  if (resolvedSession) {
    return resolvedSession
  }

  clearAuthCookies(context?.res)
  return null
}

export default getSessionSafe
