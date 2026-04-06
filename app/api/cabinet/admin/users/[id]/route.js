import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import { LOCATIONS } from '@server/serverConstants'
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

const normalizeRole = (value) =>
  typeof value === 'string' ? value.trim().toLowerCase() : ''
const resolveAllowedLocations = () =>
  Object.entries(LOCATIONS)
    .filter(([, value]) => !value?.hidden)
    .map(([key]) => key)
const normalizeLocation = (value) =>
  typeof value === 'string' ? value.trim().toLowerCase() : ''

export async function PUT(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user || !isUserAdmin({ role: session.user.role })) {
    return NextResponse.json(
      { success: false, error: 'Недостаточно прав' },
      { status: 403 },
    )
  }

  const resolvedParams = await params
  const userId =
    typeof resolvedParams?.id === 'string' ? resolvedParams.id.trim() : ''
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

    const actorRole = normalizeRole(session?.user?.role)
    const isActorDeveloper = actorRole === 'dev'

    const UsersModel = db.model('Users')
    const existingUser = await UsersModel.findById(userId).select({ role: 1 }).lean()
    if (!existingUser) {
      return NextResponse.json(
        { success: false, error: 'Пользователь не найден' },
        { status: 404 },
      )
    }

    const body = await request.json().catch(() => ({}))
    const nextRole = ensureRole(body.role)
    const allowedLocations = resolveAllowedLocations()
    const requestedLocation = normalizeLocation(body.currentLocation)
    if (requestedLocation && !allowedLocations.includes(requestedLocation)) {
      return NextResponse.json(
        { success: false, error: 'Некорректный город пользователя' },
        { status: 400 },
      )
    }
    const currentLocation =
      requestedLocation && allowedLocations.includes(requestedLocation)
        ? requestedLocation
        : null
    const targetCurrentRole = normalizeRole(existingUser?.role)
    const targetNextRole = normalizeRole(nextRole)

    if (!isActorDeveloper && targetCurrentRole === 'dev') {
      return NextResponse.json(
        {
          success: false,
          error:
            'Только разработчик может изменять карточку пользователя с ролью «Разработчик».',
        },
        { status: 403 },
      )
    }

    if (!isActorDeveloper && targetNextRole === 'dev') {
      return NextResponse.json(
        {
          success: false,
          error: 'Только разработчик может назначать роль «Разработчик».',
        },
        { status: 403 },
      )
    }

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
      role: nextRole,
      currentLocation,
    }

    const updatedUser = await UsersModel
      .findByIdAndUpdate(userId, { $set: payload }, { returnDocument: 'after' })
      .lean()

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

