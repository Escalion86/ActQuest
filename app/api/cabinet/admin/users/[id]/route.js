import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
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

export async function PUT(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user || !isUserAdmin({ role: session.user.role })) {
    return NextResponse.json(
      { success: false, error: 'Недостаточно прав' },
      { status: 403 },
    )
  }

  const userId = typeof params?.id === 'string' ? params.id.trim() : ''
  if (!userId) {
    return NextResponse.json(
      { success: false, error: 'Не указан идентификатор пользователя' },
      { status: 400 },
    )
  }

  try {
    const db = await dbConnectGlobal()
    if (!db) {
      return NextResponse.json(
        { success: false, error: 'База пользователей недоступна' },
        { status: 503 },
      )
    }

    const body = await request.json().catch(() => ({}))
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
      return NextResponse.json(
        { success: false, error: 'Пользователь не найден' },
        { status: 404 },
      )
    }

    return NextResponse.json(
      {
        success: true,
        data: updatedUser,
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('Failed to update user from admin modal (app)', error)
    return NextResponse.json(
      { success: false, error: 'Не удалось обновить пользователя' },
      { status: 500 },
    )
  }
}
