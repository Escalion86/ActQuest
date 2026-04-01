import { getServerSession } from 'next-auth/next'
import { authOptions } from '@pages/api/auth/[...nextauth]'
import resolveSessionUserFilter from '@helpers/resolveSessionUserFilter'
import dbConnectGlobal from '@utils/dbConnectGlobal'

const sanitizeText = (value) => (typeof value === 'string' ? value.trim() : '')

const sanitizeNullableText = (value) => {
  const normalized = sanitizeText(value)
  return normalized.length > 0 ? normalized : null
}

export default async function handler(req, res) {
  if (req.method !== 'PUT') {
    res.setHeader('Allow', ['PUT'])
    return res.status(405).json({ success: false, error: 'Метод не поддерживается' })
  }

  const session = await getServerSession(req, res, authOptions)
  if (!session?.user) {
    return res.status(401).json({ success: false, error: 'Необходима авторизация' })
  }

  const filter = resolveSessionUserFilter(session.user)
  if (!filter) {
    return res.status(400).json({
      success: false,
      error: 'Не удалось определить пользователя для обновления профиля.',
    })
  }

  try {
    const globalDb = await dbConnectGlobal()
    if (!globalDb) {
      return res.status(503).json({
        success: false,
        error: 'Глобальная база пользователей недоступна',
      })
    }

    const body = req.body || {}
    const payload = {
      name: sanitizeText(body.name),
      username: sanitizeNullableText(body.username),
      photoUrl: sanitizeNullableText(body.photoUrl),
      about: sanitizeText(body.about),
      preferences: Array.isArray(body.preferences)
        ? Array.from(
            new Set(
              body.preferences
                .map((item) => sanitizeText(item))
                .filter((item) => item.length > 0),
            ),
          )
        : [],
    }

    const updatedUser = await globalDb
      .model('Users')
      .findOneAndUpdate(
        filter,
        { $set: payload },
        { new: true },
      )
      .lean()

    if (!updatedUser) {
      return res.status(404).json({ success: false, error: 'Пользователь не найден.' })
    }

    return res.status(200).json({
      success: true,
      data: updatedUser,
    })
  } catch (error) {
    console.error('Failed to update profile in global db', error)
    return res.status(500).json({
      success: false,
      error: 'Не удалось сохранить профиль. Попробуйте позже.',
    })
  }
}
