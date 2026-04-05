import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import dbConnectGlobal from '@utils/dbConnectGlobal'

const toStringId = (value) => {
  if (value === null || value === undefined) {
    return null
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
  }
  if (typeof value === 'number') {
    return String(value)
  }
  if (typeof value?.toString === 'function') {
    const parsed = value.toString()
    return parsed === '[object Object]' ? null : parsed
  }
  return null
}

const normalizeRole = (value) => {
  if (typeof value !== 'string') {
    return 'client'
  }
  const normalizedRaw = value.trim().toLowerCase()
  const normalized = normalizedRaw
  return ['client', 'moder', 'admin', 'dev'].includes(normalized)
    ? normalized
    : 'client'
}

const isElevatedRole = (role) => role === 'admin' || role === 'dev'

export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: 'Необходима авторизация' },
      { status: 401 },
    )
  }

  const body = await request.json().catch(() => ({}))
  const payload = body?.data && typeof body.data === 'object' ? body.data : body

  const teamId = toStringId(payload?.teamId)
  const requestedRole = String(payload?.role ?? 'participant')
    .trim()
    .toLowerCase()
  const role = requestedRole === 'capitan' ? 'capitan' : 'participant'

  if (!teamId) {
    return NextResponse.json(
      { success: false, error: 'Не указан идентификатор команды' },
      { status: 400 },
    )
  }

  try {
    const db = await dbConnectGlobal()
    if (!db) {
      throw new Error('Соединение с базой данных не установлено')
    }

    const TeamsModel = db.model('Teams')
    const TeamsUsersModel = db.model('TeamsUsers')

    const team = await TeamsModel.findById(teamId).select({ _id: 1, open: 1 }).lean()
    if (!team?._id) {
      return NextResponse.json(
        { success: false, error: 'Команда не найдена' },
        { status: 404 },
      )
    }

    const actorRole = normalizeRole(session.user.role)
    const actorUserId = toStringId(
      session.user.globalUserId ?? session.user.userId ?? session.user._id,
    )
    const actorTelegramIdRaw = Number(session.user.telegramId)
    const actorTelegramId = Number.isFinite(actorTelegramIdRaw)
      ? actorTelegramIdRaw
      : null

    if (!actorUserId && actorTelegramId === null) {
      return NextResponse.json(
        { success: false, error: 'Не удалось определить пользователя' },
        { status: 403 },
      )
    }

    if (!isElevatedRole(actorRole) && role === 'capitan') {
      return NextResponse.json(
        { success: false, error: 'Назначать капитана может только капитан команды' },
        { status: 403 },
      )
    }

    if (!isElevatedRole(actorRole) && team?.open === false) {
      return NextResponse.json(
        {
          success: false,
          error: 'В этой команде закрыт набор. Попросите капитана добавить вас вручную.',
        },
        { status: 403 },
      )
    }

    const membershipFilter = {
      teamId,
      $or: [
        ...(actorUserId ? [{ userId: actorUserId }] : []),
        ...(Number.isFinite(actorTelegramId)
          ? [{ userTelegramId: actorTelegramId }]
          : []),
      ],
    }

    const existingMembership = await TeamsUsersModel.findOne(membershipFilter)
      .select({ _id: 1 })
      .lean()
    if (existingMembership?._id) {
      return NextResponse.json(
        { success: false, error: 'Вы уже состоите в этой команде' },
        { status: 409 },
      )
    }

    const createdMembership = await TeamsUsersModel.create({
      teamId,
      userId: actorUserId,
      userTelegramId: actorTelegramId,
      role,
    })

    return NextResponse.json(
      {
        success: true,
        data: {
          id: toStringId(createdMembership?._id),
          teamId,
          role,
        },
      },
      { status: 201 },
    )
  } catch (error) {
    console.error('Failed to add team membership via cabinet API (app)', error)
    return NextResponse.json(
      { success: false, error: 'Не удалось добавить участника в команду' },
      { status: 500 },
    )
  }
}
