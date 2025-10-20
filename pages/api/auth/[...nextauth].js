import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import dbConnect from '@utils/dbConnect'
import authenticateTelegramUser from '@helpers/authenticateTelegramUser'

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
    telegramId: user?.telegramId ?? fallbackData.telegramId ?? null,
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
            throw new Error(result.errorCode || 'TELEGRAM_AUTH_FAILED')
          }

          return { ...result.user, isTestAuth: Boolean(result.isTestAuth) }
        } catch (error) {
          console.error('Telegram authorize unexpected error', error)
          throw error
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = ensureSerializableId(user.id ?? user._id ?? null)
        token.telegramId = user.telegramId
        token.location = user.location
        token.name = user.name
        token.username = user.username
        token.photoUrl = user.photoUrl
        token.languageCode = user.languageCode
        token.isPremium = user.isPremium
        token.isTestAuth = Boolean(user.isTestAuth)
      }

      return token
    },
    async session({ session, token }) {
      if (!session?.user) session.user = {}

      if (token?.telegramId && token?.location) {
        const fallbackUser = {
          _id: token.userId ?? null,
          id: token.userId ?? null,
          userId: token.userId ?? null,
          telegramId: token.telegramId,
          name: token.name,
          username: token.username,
          photoUrl: token.photoUrl,
          languageCode: token.languageCode,
          isPremium: token.isPremium,
          location: token.location,
        }

        if (token?.isTestAuth) {
          session.user = normalizeUserForSession(null, fallbackUser)
          session.user.location = token.location
          session.user.isTestAuth = true
          return session
        }

        try {
          const db = await dbConnect(token.location)
          if (db) {
            const user = await db
              .model('Users')
              .findOne({ telegramId: token.telegramId })
              .lean()

            session.user = normalizeUserForSession(user, fallbackUser)
            session.user.location = token.location
          } else {
            session.user = normalizeUserForSession(null, fallbackUser)
          }
        } catch (error) {
          console.error('Session callback error', error)
          session.user = normalizeUserForSession(null, fallbackUser)
        }
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
