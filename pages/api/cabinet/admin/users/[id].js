import { getServerSession } from 'next-auth/next'

import { authOptions } from '@pages/api/auth/[...nextauth]'
import ensureRole from '@helpers/ensureRole'
import isUserAdmin from '@helpers/isUserAdmin'
import dbConnectGlobal from '@utils/dbConnectGlobal'

const sanitizeText = (value) => (typeof value === 'string' ? value.trim() : '')

const sanitizeNullableText = (value) => {
  const normalized = sanitizeText(value)
  return normalized.length > 0 ? normalized : null
}

const sanitizePhone = (value) => {
  if (value === null || value === undefined || value === '') return null
  const digits = String(value).replace(/\D/g, '')
  if (digits.length !== 11 || !digits.startsWith('7')) return null
  const asNumber = Number(digits)
  return Number.isFinite(asNumber) ? asNumber : null
}

export default async function handler(req, res) {
  if (req.method !== 'PUT') {
    res.setHeader('Allow', ['PUT'])
    return res.status(405).json({ success: false, error: 'Метод не поддерживается' })
  }

  const session = await getServerSession(req, res, authOptions)
  if (!session?.user || !isUserAdmin({ role: session.user.role })) {
    return res.status(403).json({ success: false, error: 'Недостаточно прав' })
  }

  const userId = typeof req.query?.id === 'string' ? req.query.id.trim() : ''
  if (!userId) {
    return res.status(400).json({ success: false, error: 'Не указан идентификатор пользователя' })
  }

  try {
    const db = await dbConnectGlobal()
    if (!db) {
      return res.status(503).json({ success: false, error: 'База пользователей недоступна' })
    }

    const body = req.body || {}
    const payload = {
      name: sanitizeText(body.name),
      username: sanitizeNullableText(body.username),
      photoUrl: sanitizeNullableText(body.photoUrl),
      phone: sanitizePhone(body.phone),
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
      role: ensureRole(body.role),
    }

    const updatedUser = await db
      .model('Users')
      .findByIdAndUpdate(userId, { $set: payload }, { new: true })
      .lean()

    if (!updatedUser) {
      return res.status(404).json({ success: false, error: 'Пользователь не найден' })
    }

    return res.status(200).json({
      success: true,
      data: updatedUser,
    })
  } catch (error) {
    console.error('Failed to update user from admin modal', error)
    return res.status(500).json({ success: false, error: 'Не удалось обновить пользователя' })
  }
}
