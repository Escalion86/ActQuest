import CredentialsProvider from 'next-auth/providers/credentials'
import { cookies } from 'next/headers'
import dbConnectGlobal from '@utils/dbConnectGlobal'
import authenticateTelegramUser from '@helpers/authenticateTelegramUser'
import authenticateVkUser from '@helpers/authenticateVkUser'
import authenticatePasswordUser from '@helpers/authenticatePasswordUser'
import { getSiteAccessControlsByLocation } from '@helpers/siteAccessControls'
import { exchangeVkCode, fetchVkUserInfo } from '@helpers/vkIdAuth'
import resolveUserCityKey from '@helpers/resolveUserCityKey'
import { getAuthSecret } from '@server/auth/authSecret'

const isVkDebugEnabled =
  process.env.VK_AUTH_DEBUG === 'true' || process.env.VK_DEBUG_LOGS === 'true'
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

const ensureSerializableId = (value) => {
  if (value === null || value === undefined) return null
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  if (typeof value === 'object' && typeof value.toString === 'function') {
    const stringValue = value.toString()
    return stringValue && stringValue !== '[object Object]' ? stringValue : null
  }

  return null
}

const normalizeUserForSession = (user, fallback = {}) => {
  const { userId: fallbackUserId, ...fallbackData } = fallback

  const normalizedUser = {
    ...fallbackData,
    globalUserId:
      user?.globalUserId ??
      fallbackData.globalUserId ??
      ensureSerializableId(user?._id ?? user?.id ?? fallbackUserId ?? null),
    telegramId: user?.telegramId ?? fallbackData.telegramId ?? null,
    vkId: user?.vkId ?? fallbackData.vkId ?? null,
    phone: user?.phone ?? fallbackData.phone ?? null,
    authMethod: user?.authMethod ?? fallbackData.authMethod ?? 'telegram',
    name: user?.name ?? fallbackData.name ?? null,
    username: user?.username ?? fallbackData.username ?? null,
    photoUrl: user?.photoUrl ?? fallbackData.photoUrl ?? null,
    languageCode: user?.languageCode ?? fallbackData.languageCode ?? null,
    isPremium: user?.isPremium ?? fallbackData.isPremium ?? false,
    role: user?.role ?? fallbackData.role ?? 'client',
    location: resolveUserCityKey(user, fallbackData.location),
  }

  const rawId =
    user?._id ??
    user?.id ??
    fallbackData._id ??
    fallbackData.id ??
    fallbackUserId ??
    null

  normalizedUser._id = ensureSerializableId(rawId)

  return normalizedUser
}

const normalizeLocation = (value) => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().toLowerCase()
  return trimmed || null
}

export const authOptions = {
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60,
    updateAge: 24 * 60 * 60,
  },
  jwt: {
    maxAge: 30 * 24 * 60 * 60,
  },
  secret: getAuthSecret(),
  providers: [
    CredentialsProvider({
      id: 'telegram',
      name: 'Telegram',
      credentials: {
        data: { label: 'Telegram auth data', type: 'text' },
        location: { label: 'Location', type: 'text' },
      },
      authorize: async (credentials) => {
        const location = credentials?.location
        const rawData = credentials?.data

        try {
          const result = await authenticateTelegramUser({ location, rawData })

          if (!result.success) {
            console.error('Telegram authorize error', {
              location,
              errorCode: result.errorCode,
              errorMessage: result.errorMessage,
            })
            throw new Error(
              result.errorMessage || result.errorCode || 'TELEGRAM_AUTH_FAILED',
            )
          }

          return { ...result.user, isTestAuth: Boolean(result.isTestAuth) }
        } catch (error) {
          console.error('Telegram authorize unexpected error', error)
          throw error
        }
      },
    }),
    CredentialsProvider({
      id: 'vk',
      name: 'VK',
      credentials: {
        data: { label: 'VK auth data', type: 'text' },
        location: { label: 'Location', type: 'text' },
        code: { label: 'Code', type: 'text' },
        deviceId: { label: 'DeviceId', type: 'text' },
        accessToken: { label: 'AccessToken', type: 'text' },
        state: { label: 'State', type: 'text' },
        codeVerifier: { label: 'CodeVerifier', type: 'text' },
        mode: { label: 'Mode', type: 'text' },
      },
      authorize: async (credentials) => {
        const location = normalizeLocation(credentials?.location)
        const rawData = credentials?.data
        const code = credentials?.code ? String(credentials.code) : null
        const deviceId = credentials?.deviceId
          ? String(credentials.deviceId)
          : null
        const accessTokenFromClient = credentials?.accessToken
          ? String(credentials.accessToken)
          : null
        const state = credentials?.state ? String(credentials.state) : null
        const codeVerifier = credentials?.codeVerifier
          ? String(credentials.codeVerifier)
          : null

        try {
          const controls = await getSiteAccessControlsByLocation(location)
          if (!controls.allowSiteAuth) {
            throw new Error('AUTH_DISABLED')
          }
          if (!controls.enableVkOneTap) {
            throw new Error('VK_ONETAP_DISABLED')
          }

          let result = null

          if ((code && deviceId) || accessTokenFromClient) {
            let exchangeResult = null
            const accessToken = accessTokenFromClient || null
            let resolvedAccessToken = accessToken

            if (!resolvedAccessToken) {
              exchangeResult = await exchangeVkCode({
                code,
                deviceId,
                codeVerifier,
                state,
              })

              if (!exchangeResult?.success) {
                if (isVkDebugEnabled) {
                  console.info('[VK_DEBUG] nextauth_vk_exchange_failed', {
                    location,
                    error: exchangeResult?.data?.error || null,
                  })
                }
                throw new Error('VK_EXCHANGE_FAILED')
              }

              resolvedAccessToken = exchangeResult?.data?.access_token
            }

            if (!resolvedAccessToken) {
              throw new Error('VK_EXCHANGE_FAILED')
            }

            const userInfoResult = await fetchVkUserInfo({
              accessToken: resolvedAccessToken,
            })
            if (!userInfoResult?.success) {
              if (isVkDebugEnabled) {
                console.info('[VK_DEBUG] nextauth_vk_userinfo_failed', {
                  location,
                  error: userInfoResult?.data?.error || null,
                })
              }
              throw new Error('VK_USERINFO_FAILED')
            }

            const vkUser = userInfoResult?.data?.user || {}
            const vkId =
              vkUser?.user_id || exchangeResult?.data?.user_id || null

            if (!vkId) {
              throw new Error('VK_PROFILE_INVALID')
            }

            const normalizedPayload = JSON.stringify({
              accessToken: resolvedAccessToken,
              vkId,
              phone: vkUser?.phone || null,
              firstName: vkUser?.first_name || '',
              lastName: vkUser?.last_name || '',
              photoUrl: vkUser?.avatar || vkUser?.photo_200 || null,
            })

            result = await authenticateVkUser({
              location,
              rawData: normalizedPayload,
            })
          } else {
            if (!rawData) {
              throw new Error('VK_BAD_REQUEST')
            }
            // fallback для старого клиентского flow
            result = await authenticateVkUser({ location, rawData })
          }

          if (!result.success) {
            console.error('VK authorize error', {
              location,
              errorCode: result.errorCode,
              errorMessage: result.errorMessage,
            })
            if (isVkDebugEnabled) {
              console.info('[VK_DEBUG] nextauth_vk_authorize_failed', {
                location,
                errorCode: result.errorCode,
                details: result.details ?? null,
                payloadKeys:
                  result?.payload && typeof result.payload === 'object'
                    ? Object.keys(result.payload).sort()
                    : [],
              })
            }
            throw new Error(
              result.errorCode || result.errorMessage || 'VK_AUTH_FAILED',
            )
          }

          return { ...result.user, authMethod: 'vk' }
        } catch (error) {
          console.error('VK authorize unexpected error', error)
          if (isVkDebugEnabled) {
            console.info('[VK_DEBUG] nextauth_vk_authorize_exception', {
              location,
              message: error?.message ?? null,
              stack: error?.stack ?? null,
            })
          }
          throw error
        }
      },
    }),
    CredentialsProvider({
      id: 'password',
      name: 'Password',
      credentials: {
        data: { label: 'Password auth data', type: 'text' },
        location: { label: 'Location', type: 'text' },
      },
      authorize: async (credentials) => {
        const location = normalizeLocation(credentials?.location)
        const rawData = credentials?.data

        try {
          const controls = await getSiteAccessControlsByLocation(location)
          if (!controls.allowSiteAuth) {
            throw new Error('AUTH_DISABLED')
          }

          const result = await authenticatePasswordUser({ location, rawData })

          if (!result.success) {
            console.error('Password authorize error', {
              location,
              errorCode: result.errorCode,
              errorMessage: result.errorMessage,
            })
            throw new Error(
              result.errorMessage || result.errorCode || 'PASSWORD_AUTH_FAILED',
            )
          }

          return { ...result.user, authMethod: 'phone' }
        } catch (error) {
          console.error('Password authorize unexpected error', error)
          throw error
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      sessionDebugLog('nextauth:jwt:start', {
        hasUser: Boolean(user),
        trigger: trigger ?? null,
        tokenUserId: token?.globalUserId ?? token?.userId ?? null,
      })

      if (user) {
        const resolvedGlobalUserId = ensureSerializableId(
          user.globalUserId ?? user.id ?? user._id ?? null,
        )
        let resolvedRole = user.role ?? null

        if (!resolvedRole && resolvedGlobalUserId) {
          try {
            const globalDb = await dbConnectGlobal()
            if (globalDb) {
              const dbUser = await globalDb
                .model('Users')
                .findById(resolvedGlobalUserId)
                .select({ role: 1 })
                .lean()

              if (typeof dbUser?.role === 'string' && dbUser.role.trim()) {
                resolvedRole = dbUser.role
              }
            }
          } catch (roleResolveError) {
            console.error('JWT role resolve error', roleResolveError)
          }
        }

        token.globalUserId = resolvedGlobalUserId
        token.userId = resolvedGlobalUserId
        token.telegramId = user.telegramId
        token.vkId = user.vkId
        token.phone = user.phone ?? null
        token.role = resolvedRole ?? token.role ?? 'client'
        token.authMethod =
          user.authMethod ??
          (user.vkId ? 'vk' : user.phone ? 'phone' : 'telegram')
        token.location = resolveUserCityKey(user, token.location)
        token.name = user.name
        token.username = user.username
        token.photoUrl = user.photoUrl ?? token.photoUrl ?? null
        token.languageCode = user.languageCode
        token.isPremium = user.isPremium
        token.isTestAuth = Boolean(user.isTestAuth)
      }

      if (trigger === 'update') {
        const nextLocation =
          session?.location ?? session?.user?.location ?? null

        if (
          typeof nextLocation === 'string' &&
          nextLocation.trim().length > 0
        ) {
          token.location = nextLocation.trim()
        }
      }

      sessionDebugLog('nextauth:jwt:done', {
        tokenUserId: token?.globalUserId ?? token?.userId ?? null,
        role: token?.role ?? null,
        location: token?.location ?? null,
      })
      return token
    },
    async session({ session, token, req }) {
      sessionDebugLog('nextauth:session:start', {
        tokenUserId: token?.globalUserId ?? token?.userId ?? null,
        tokenRole: token?.role ?? null,
        tokenTelegramId: token?.telegramId ?? null,
        tokenPhone: token?.phone ?? null,
        tokenAuthMethod: token?.authMethod ?? null,
      })
      if (!session?.user) session.user = {}

      // Проверить режим impersonate для разработчиков
      let targetUserId = null
      let isDeveloperImpersonating = false

      if (token?.role === 'dev') {
        try {
          // Вариант 1: Попробуем читать из req.headers
          let cookieDeveloperImpersonate = null

          if (req?.headers) {
            try {
              // Try req.headers.get() (modern approach)
              if (typeof req.headers.get === 'function') {
                const cookieHeader = req.headers.get('cookie') || ''
                if (cookieHeader) {
                  const cookies = cookieHeader
                    .split(';')
                    .reduce((acc, cookie) => {
                      const [key, value] = cookie.trim().split('=')
                      if (key && value) {
                        acc[key] = decodeURIComponent(value)
                      }
                      return acc
                    }, {})
                  cookieDeveloperImpersonate = cookies['dev-impersonate']
                }
              }

              // Fallback: req.headers.cookie (older approach)
              if (
                !cookieDeveloperImpersonate &&
                typeof req.headers.cookie === 'string'
              ) {
                const cookies = req.headers.cookie
                  .split(';')
                  .reduce((acc, cookie) => {
                    const [key, value] = cookie.trim().split('=')
                    if (key && value) {
                      acc[key] = decodeURIComponent(value)
                    }
                    return acc
                  }, {})
                cookieDeveloperImpersonate = cookies['dev-impersonate']
              }
            } catch (headerError) {
              sessionDebugLog('nextauth:session:impersonate:header-error', {
                error: headerError?.message ?? 'Unknown',
              })
            }
          }

          // Вариант 2: Fallback на cookies() из next/headers (если Вариант 1 не сработал)
          if (!cookieDeveloperImpersonate) {
            try {
              const cookieStore = await cookies()
              cookieDeveloperImpersonate =
                cookieStore?.get('dev-impersonate')?.value
              sessionDebugLog('nextauth:session:impersonate:cookies-store', {
                found: Boolean(cookieDeveloperImpersonate),
              })
            } catch (cookiesError) {
              sessionDebugLog(
                'nextauth:session:impersonate:cookies-store-error',
                {
                  error: cookiesError?.message ?? 'Unknown',
                },
              )
            }
          }

          sessionDebugLog('nextauth:session:impersonate:cookie-read', {
            cookieFound: Boolean(cookieDeveloperImpersonate),
          })

          if (cookieDeveloperImpersonate) {
            const [userId] = cookieDeveloperImpersonate.split('|')
            if (userId) {
              targetUserId = userId
              isDeveloperImpersonating = true
              sessionDebugLog('nextauth:session:impersonate:detected', {
                targetUserId,
              })
            }
          }
        } catch (error) {
          console.error('Error reading impersonate cookie:', error)
        }
      }

      const fallbackUser = {
        _id: token.globalUserId ?? token.userId ?? null,
        id: token.globalUserId ?? token.userId ?? null,
        userId: token.globalUserId ?? token.userId ?? null,
        globalUserId: token.globalUserId ?? token.userId ?? null,
        telegramId: token.telegramId,
        vkId: token.vkId,
        phone: token.phone,
        name: token.name,
        username: token.username,
        photoUrl: token.photoUrl,
        languageCode: token.languageCode,
        isPremium: token.isPremium,
        location: token.location ?? null,
        role: token.role ?? 'client',
      }
      let didLoadUserFromDb = false

      try {
        let user = null
        let userIdToLoad = isDeveloperImpersonating
          ? targetUserId
          : token.globalUserId || token.userId

        sessionDebugLog('nextauth:session:load-user', {
          isDeveloperImpersonating,
          targetUserId,
          userIdToLoad,
          tokenUserId: token.globalUserId || token.userId,
        })

        const globalDb = await dbConnectGlobal()
        if (globalDb) {
          if (userIdToLoad) {
            try {
              user = await globalDb.model('Users').findById(userIdToLoad).lean()
              didLoadUserFromDb = Boolean(user)

              sessionDebugLog('nextauth:session:load-user:result', {
                userIdToLoad,
                userFound: Boolean(user),
                userRole: user?.role ?? null,
                userName: user?.username ?? null,
              })
            } catch (idError) {
              sessionDebugLog('nextauth:session:load-user:error', {
                userIdToLoad,
                error: idError?.message ?? 'Unknown error',
              })
              // ignore
            }
          }

          if (
            !user &&
            !isDeveloperImpersonating &&
            typeof token.phone !== 'undefined' &&
            token.phone !== null
          ) {
            user = await globalDb
              .model('Users')
              .findOne({ phone: token.phone })
              .lean()
          }
        }

        session.user = normalizeUserForSession(user, fallbackUser)

        if (user) {
          // Если пользователь загружен из БД, используем только значение локации из БД.
          // Важно: null из БД не должен подменяться старым token.location.
          session.user.location = resolveUserCityKey(user, null)
        }

        // Если разработчик импер сонирует, добавить индикатор
        if (isDeveloperImpersonating) {
          session.user.isDeveloperImpersonating = true
          session.user.developerUserId = token.globalUserId ?? token.userId

          // КРИТИЧНО: В режиме impersonate, переписать данные целевого пользователя,
          // игнорируя fallbackUser (который имеет данные разработчика)
          if (user) {
            session.user.role = user.role ?? 'client'
            session.user.globalUserId = ensureSerializableId(
              user._id ?? user.id ?? null,
            )
            session.user.photoUrl = user.photoUrl ?? null
            session.user.name = user.name ?? null
            session.user.username = user.username ?? null
            session.user.phone = user.phone ?? null
            session.user.telegramId = user.telegramId ?? null
            session.user.vkId = user.vkId ?? null
          }
        } else {
          // Явно обнулить флаг если режима impersonate нет
          session.user.isDeveloperImpersonating = false
          delete session.user.developerUserId
        }

        sessionDebugLog('nextauth:session:after-normalize', {
          sessionUserRole: session?.user?.role ?? null,
          isDeveloperImpersonating:
            session?.user?.isDeveloperImpersonating ?? false,
          sessionUserId:
            session?.user?.globalUserId ?? session?.user?._id ?? null,
        })

        if (isDeveloperImpersonating) {
          sessionDebugLog('nextauth:session:after-impersonate-override', {
            sessionUserRole: session?.user?.role ?? null,
            sessionUserId:
              session?.user?.globalUserId ?? session?.user?._id ?? null,
            isDeveloperImpersonating:
              session?.user?.isDeveloperImpersonating ?? false,
          })
        }
      } catch (error) {
        console.error('Session callback error', error)
        session.user = normalizeUserForSession(null, fallbackUser)
      }

      session.user.globalUserId =
        session.user.globalUserId ??
        session.user._id ??
        token.globalUserId ??
        token.userId ??
        null
      const normalizedSessionLocation = normalizeLocation(session.user.location)
      const normalizedTokenLocation = normalizeLocation(token.location)
      session.user.location = didLoadUserFromDb
        ? normalizedSessionLocation
        : normalizedSessionLocation ?? normalizedTokenLocation ?? null
      session.user.role = session.user.role ?? token.role ?? 'client'
      session.user.isTestAuth = Boolean(token.isTestAuth)

      sessionDebugLog('nextauth:session:done', {
        sessionUserId:
          session?.user?.globalUserId ?? session?.user?._id ?? null,
        role: session?.user?.role ?? null,
        location: session?.user?.location ?? null,
        telegramId: session?.user?.telegramId ?? null,
        phone: session?.user?.phone ?? null,
        authMethod: session?.user?.authMethod ?? null,
        isDeveloperImpersonating:
          session?.user?.isDeveloperImpersonating ?? false,
        developerUserId: session?.user?.developerUserId ?? null,
      })
      return session
    },
  },
  pages: {
    signIn: '/cabinet/login',
  },
}
