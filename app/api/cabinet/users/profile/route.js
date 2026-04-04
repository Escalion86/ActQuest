import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import resolveSessionUserFilter from '@helpers/resolveSessionUserFilter'
import dbConnectGlobal from '@utils/dbConnectGlobal'

const sanitizeText = (value) => (typeof value === 'string' ? value.trim() : '')

const sanitizeNullableText = (value) => {
  const normalized = sanitizeText(value)
  return normalized.length > 0 ? normalized : null
}

export async function PUT(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: 'Необходима авторизация' },
      { status: 401 },
    )
  }

  const filter = resolveSessionUserFilter(session.user)
  if (!filter) {
    return NextResponse.json(
      {
        success: false,
        error: 'Не удалось определить пользователя для обновления профиля.',
      },
      { status: 400 },
    )
  }

  try {
    const globalDb = await dbConnectGlobal()
    if (!globalDb) {
      return NextResponse.json(
        {
          success: false,
          error: 'Глобальная база пользователей недоступна',
        },
        { status: 503 },
      )
    }

    const body = await request.json().catch(() => ({}))
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
      .findOneAndUpdate(filter, { $set: payload }, { new: true })
      .lean()

    if (!updatedUser) {
      return NextResponse.json(
        { success: false, error: 'Пользователь не найден.' },
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
    console.error('Failed to update profile in global db (app)', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Не удалось сохранить профиль. Попробуйте позже.',
      },
      { status: 500 },
    )
  }
}
