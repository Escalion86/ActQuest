import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import dbConnect from '@utils/dbConnect'
import dbConnectGlobal from '@utils/dbConnectGlobal'
import authenticateTelegramUser from '@helpers/authenticateTelegramUser'
import authenticateVkUser from '@helpers/authenticateVkUser'
import authenticatePasswordUser from '@helpers/authenticatePasswordUser'
import { getSiteAccessControlsByLocation } from '@helpers/siteAccessControls'
import { exchangeVkCode, fetchVkUserInfo } from '@helpers/vkIdAuth'

const isVkDebugEnabled =
  process.env.VK_AUTH_DEBUG === 'true' ||
  process.env.VK_DEBUG_LOGS === 'true'

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
  },
  secret: process.env.SECRET,
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
        state: { label: 'State', type: 'text' },
        codeVerifier: { label: 'CodeVerifier', type: 'text' },
        mode: { label: 'Mode', type: 'text' },
      },
      authorize: async (credentials) => {
        const location = normalizeLocation(credentials?.location)
        const rawData = credentials?.data
        const code = credentials?.code ? String(credentials.code) : null
        const deviceId = credentials?.deviceId ? String(credentials.deviceId) : null
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

          if (code && deviceId) {
            const exchangeResult = await exchangeVkCode({
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

            const accessToken = exchangeResult?.data?.access_token
            if (!accessToken) {
              throw new Error('VK_EXCHANGE_FAILED')
            }

            const userInfoResult = await fetchVkUserInfo({ accessToken })
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
              vkUser?.user_id ||
              exchangeResult?.data?.user_id ||
              null

            if (!vkId) {
              throw new Error('VK_PROFILE_INVALID')
            }

            const normalizedPayload = JSON.stringify({
              accessToken,
              vkId,
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
            throw new Error(result.errorMessage || result.errorCode || 'VK_AUTH_FAILED')
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
      if (user) {
        const resolvedGlobalUserId = ensureSerializableId(
          user.globalUserId ?? user.id ?? user._id ?? null,
        )
        token.globalUserId = resolvedGlobalUserId
        token.userId = resolvedGlobalUserId
        token.telegramId = user.telegramId
        token.vkId = user.vkId
        token.phone = user.phone ?? null
        token.authMethod =
          user.authMethod ?? (user.vkId ? 'vk' : user.phone ? 'phone' : 'telegram')
        token.location = user.location
        token.name = user.name
        token.username = user.username
        token.photoUrl = user.photoUrl
        token.languageCode = user.languageCode
        token.isPremium = user.isPremium
        token.isTestAuth = Boolean(user.isTestAuth)
      }

      if (trigger === 'update') {
        const nextLocation =
          session?.location ??
          session?.user?.location ??
          null

        if (typeof nextLocation === 'string' && nextLocation.trim().length > 0) {
          token.location = nextLocation.trim()
        }
      }

      return token
    },
    async session({ session, token }) {
      if (!session?.user) session.user = {}

      if (token?.location) {
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
          location: token.location,
        }

        try {
          let user = null

          const globalDb = await dbConnectGlobal()
          if (globalDb) {
            if (token.globalUserId || token.userId) {
              try {
                user = await globalDb
                  .model('Users')
                  .findById(token.globalUserId || token.userId)
                  .lean()
              } catch (idError) {
                // ignore
              }
            }

            if (
              !user &&
              typeof token.telegramId !== 'undefined' &&
              token.telegramId !== null
            ) {
              user = await globalDb
                .model('Users')
                .findOne({ telegramId: token.telegramId })
                .lean()
            }

            if (!user && typeof token.vkId !== 'undefined' && token.vkId !== null) {
              user = await globalDb.model('Users').findOne({ vkId: token.vkId }).lean()
            }

            if (
              !user &&
              typeof token.phone !== 'undefined' &&
              token.phone !== null
            ) {
              user = await globalDb.model('Users').findOne({ phone: token.phone }).lean()
            }
          }

          if (!user) {
            const legacyDb = await dbConnect(token.location)
            if (legacyDb) {
              if (token.userId) {
                try {
                  user = await legacyDb.model('Users').findById(token.userId).lean()
                } catch (idError) {
                  // ignore
                }
              }

              if (
                !user &&
                typeof token.telegramId !== 'undefined' &&
                token.telegramId !== null
              ) {
                user = await legacyDb
                  .model('Users')
                  .findOne({ telegramId: token.telegramId })
                  .lean()
              }

              if (!user && typeof token.vkId !== 'undefined' && token.vkId !== null) {
                user = await legacyDb.model('Users').findOne({ vkId: token.vkId }).lean()
              }

              if (
                !user &&
                typeof token.phone !== 'undefined' &&
                token.phone !== null
              ) {
                user = await legacyDb.model('Users').findOne({ phone: token.phone }).lean()
              }
            }
          }

          session.user = normalizeUserForSession(user, fallbackUser)
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
        session.user.location = token.location
        session.user.isTestAuth = Boolean(token.isTestAuth)
      }

      return session
    },
  },
  pages: {
    signIn: '/cabinet/login',
  },
}

export default function auth(req, res) {
  return NextAuth(req, res, authOptions)
}
