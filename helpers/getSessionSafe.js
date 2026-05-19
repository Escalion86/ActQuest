import { getSession } from 'next-auth/react'
import { getServerSession } from 'next-auth/next'
import { getToken } from 'next-auth/jwt'
import { authOptions } from '@server/auth/authOptions'
import { getAuthSecret } from '@server/auth/authSecret'
import dbConnectGlobal from '@utils/dbConnectGlobal'
import resolveUserCityKey from '@helpers/resolveUserCityKey'

const isSessionDebugEnabled = process.env.SESSION_DEBUG === '1'
const sessionDebugLog = (stage, payload = null) => {
  if (!isSessionDebugEnabled) {
    return
  }

  const time = new Date().toISOString()
  if (payload === null || payload === undefined) {
    console.info(`[session-debug] ${time} ${stage}`)
    return
  }

  console.info(`[session-debug] ${time} ${stage}`, payload)
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
      location: resolveUserCityKey(
        { currentLocation: sessionUser.location, accountLocation: null, location: null },
        tokenUser.location,
      ),
      role: sessionUser.role ?? tokenUser.role ?? 'client',
      isTestAuth: Boolean(sessionUser.isTestAuth ?? tokenUser.isTestAuth),
    },
    expires: session.expires ?? tokenSession?.expires ?? null,
  }
}

const toFiniteNumberOrNull = (value) => {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

const resolveUserLookupFilter = (user) => {
  if (!user) {
    return null
  }

  const globalUserId = user.globalUserId ?? user._id ?? null
  if (globalUserId) {
    return { _id: globalUserId }
  }

  const phone = toFiniteNumberOrNull(user.phone)
  if (phone !== null) {
    return { phone }
  }

  const telegramId = toFiniteNumberOrNull(user.telegramId)
  if (telegramId !== null) {
    return { telegramId }
  }

  const vkId = toFiniteNumberOrNull(user.vkId)
  if (vkId !== null) {
    return { vkId }
  }

  return null
}

const enrichSessionFromGlobalDb = async (session) => {
  if (!session?.user) {
    return session
  }

  const lookupFilter = resolveUserLookupFilter(session.user)
  if (!lookupFilter) {
    return session
  }

  try {
    const db = await dbConnectGlobal()
    if (!db) {
      return session
    }

    const userDoc = await db
      .model('Users')
      .findOne(lookupFilter)
      .select({
        _id: 1,
        telegramId: 1,
        vkId: 1,
        phone: 1,
        location: 1,
        currentLocation: 1,
        accountLocation: 1,
        role: 1,
        name: 1,
        username: 1,
        photoUrl: 1,
        languageCode: 1,
        isPremium: 1,
      })
      .lean()

    if (!userDoc?._id) {
      return session
    }

    const resolvedId = userDoc._id.toString()

    return {
      ...session,
      user: {
        ...session.user,
        _id: session.user._id ?? resolvedId,
        globalUserId: session.user.globalUserId ?? resolvedId,
        telegramId: session.user.telegramId ?? userDoc.telegramId ?? null,
        vkId: session.user.vkId ?? userDoc.vkId ?? null,
        phone: session.user.phone ?? userDoc.phone ?? null,
        location: resolveUserCityKey(
          {
            currentLocation: userDoc.currentLocation,
            accountLocation: userDoc.accountLocation,
            location: userDoc.location,
          },
          session.user.location,
        ),
        role: session.user.role ?? userDoc.role ?? 'client',
        name: session.user.name ?? userDoc.name ?? null,
        username: session.user.username ?? userDoc.username ?? null,
        photoUrl: session.user.photoUrl ?? userDoc.photoUrl ?? null,
        languageCode: session.user.languageCode ?? userDoc.languageCode ?? null,
        isPremium: Boolean(session.user.isPremium ?? userDoc.isPremium),
      },
    }
  } catch (error) {
    console.error('Не удалось обогатить сессию данными пользователя', error)
    return session
  }
}

const getSessionSafe = async (context) => {
  const req = context?.req || context
  let session = null
  const requestMeta = {
    hasReq: Boolean(context?.req || context),
    url: req?.url || null,
    hasCookies: Boolean(req?.headers?.cookie),
  }

  sessionDebugLog('getSessionSafe:start', requestMeta)

  try {
    if (context?.req && context?.res) {
      session = await getServerSession(context.req, context.res, authOptions)
      sessionDebugLog('getSessionSafe:getServerSession:done', {
        hasSession: Boolean(session?.user),
        userId: session?.user?._id ?? session?.user?.globalUserId ?? null,
      })
    }

    if (!session) {
      session = await getSession(buildSessionContext(context))
      sessionDebugLog('getSessionSafe:getSession:done', {
        hasSession: Boolean(session?.user),
        userId: session?.user?._id ?? session?.user?.globalUserId ?? null,
      })
    }
  } catch (error) {
    console.error('Не удалось получить сессию пользователя', error)
    sessionDebugLog('getSessionSafe:error:getSession', {
      message: error?.message ?? null,
    })
  }

  let token = null

  // Fallback: when SSR getSession intermittently returns null,
  // decode JWT token directly from cookies.
  try {
    if (req) {
      token = await getToken({
        req,
        secret: getAuthSecret(),
      })
      sessionDebugLog('getSessionSafe:getToken:done', {
        hasToken: Boolean(token),
        tokenUserId: token?.globalUserId ?? token?.userId ?? null,
        tokenRole: token?.role ?? null,
      })
    }
  } catch (tokenError) {
    console.error('Не удалось декодировать JWT токен пользователя', tokenError)
    sessionDebugLog('getSessionSafe:error:getToken', {
      message: tokenError?.message ?? null,
    })
  }

  const resolvedSession = mergeSessionWithToken(session, token)
  if (resolvedSession) {
    const enrichedSession = await enrichSessionFromGlobalDb(resolvedSession)
    sessionDebugLog('getSessionSafe:resolved', {
      hasSession: Boolean(enrichedSession?.user),
      userId:
        enrichedSession?.user?._id ??
        enrichedSession?.user?.globalUserId ??
        null,
      role: enrichedSession?.user?.role ?? null,
      location: enrichedSession?.user?.location ?? null,
    })
    return enrichedSession
  }

  // Не очищаем cookie автоматически: при временных сбоях получения сессии
  // это может вызывать ложный разлогин и пустые данные при client-navigation.
  sessionDebugLog('getSessionSafe:resolved:null')
  return null
}

export default getSessionSafe
