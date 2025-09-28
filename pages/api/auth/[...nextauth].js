import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import dbConnect from '@utils/dbConnect'
import getTelegramTokenByLocation from '@utils/telegram/getTelegramTokenByLocation'
import verifyTelegramAuthPayload from '@helpers/verifyTelegramAuthPayload'

const buildUserName = (payload) => {
  const parts = [payload?.first_name, payload?.last_name]
    .filter(Boolean)
    .map((value) => value.trim())
    .filter(Boolean)

  if (parts.length > 0) return parts.join(' ')
  if (payload?.username) return payload.username
  return 'Пользователь Telegram'
}

const normalizeUserForSession = (user, fallback) => ({
  ...fallback,
  _id: user?._id,
  telegramId: user?.telegramId ?? fallback.telegramId,
  name: user?.name ?? fallback.name,
  username: user?.username ?? fallback.username ?? null,
  photoUrl: user?.photoUrl ?? fallback.photoUrl ?? null,
  languageCode: user?.languageCode ?? fallback.languageCode ?? null,
  isPremium: user?.isPremium ?? fallback.isPremium ?? false,
  role: user?.role ?? fallback.role ?? 'client',
})

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
        try {
          const location = credentials?.location
          const rawData = credentials?.data

          if (!location || !rawData) return null

          const payload = JSON.parse(rawData)
          const token = getTelegramTokenByLocation(location)

          if (!verifyTelegramAuthPayload(payload, token)) return null

          const db = await dbConnect(location)
          if (!db) return null

          const name = buildUserName(payload)
          const updates = {
            name,
            username: payload?.username ?? null,
            photoUrl: payload?.photo_url ?? null,
            languageCode: payload?.language_code ?? null,
            isPremium: Boolean(payload?.is_premium),
          }

          const user = await db
            .model('Users')
            .findOneAndUpdate(
              { telegramId: payload.id },
              { $set: updates },
              {
                upsert: true,
                new: true,
                setDefaultsOnInsert: true,
              }
            )
            .lean()

          return {
            id: user._id.toString(),
            telegramId: user.telegramId,
            location,
            name: user.name,
            username: user.username,
            photoUrl: user.photoUrl,
            languageCode: user.languageCode,
            isPremium: user.isPremium,
          }
        } catch (error) {
          console.error('Telegram authorize error', error)
          return null
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id
        token.telegramId = user.telegramId
        token.location = user.location
        token.name = user.name
        token.username = user.username
        token.photoUrl = user.photoUrl
        token.languageCode = user.languageCode
        token.isPremium = user.isPremium
      }

      return token
    },
    async session({ session, token }) {
      if (!session?.user) session.user = {}

      if (token?.telegramId && token?.location) {
        const fallbackUser = {
          telegramId: token.telegramId,
          name: token.name,
          username: token.username,
          photoUrl: token.photoUrl,
          languageCode: token.languageCode,
          isPremium: token.isPremium,
          location: token.location,
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
    signIn: '/cabinet',
  },
}

export default function auth(req, res) {
  return NextAuth(req, res, authOptions)
}
