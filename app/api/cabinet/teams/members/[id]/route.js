import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import dbConnectGlobal from '@utils/dbConnectGlobal'
import { toStringId } from '@helpers/idAndDate'

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

const resolveActorIdentity = (session) => {
  const actorUserId = toStringId(
    session?.user?.globalUserId ?? session?.user?.userId ?? session?.user?._id,
  )
  const actorTelegramIdRaw = Number(session?.user?.telegramId)
  const actorTelegramId =
    Number.isFinite(actorTelegramIdRaw) && actorTelegramIdRaw !== 0
      ? actorTelegramIdRaw
      : null

  return { actorUserId, actorTelegramId }
}

const ensureCanManageMembership = async ({
  db,
  actorRole,
  actorUserId,
  actorTelegramId,
  membership,
}) => {
  if (isElevatedRole(actorRole)) {
    return true
  }

  const memberUserId = toStringId(membership?.userId)
  const memberTelegramIdRaw = Number(membership?.userTelegramId)
  const memberTelegramId = Number.isFinite(memberTelegramIdRaw)
    ? memberTelegramIdRaw
    : null

  const isSelfMembership =
    (actorUserId && memberUserId && actorUserId === memberUserId) ||
    (Number.isFinite(actorTelegramId) &&
      Number.isFinite(memberTelegramId) &&
      actorTelegramId === memberTelegramId)
  if (isSelfMembership) {
    return true
  }

  const TeamsUsersModel = db.model('TeamsUsers')
  const captainMembership = await TeamsUsersModel.findOne({
    teamId: membership.teamId,
    role: 'capitan',
    $or: [
      ...(actorUserId ? [{ userId: actorUserId }] : []),
      ...(Number.isFinite(actorTelegramId)
        ? [{ userTelegramId: actorTelegramId }]
        : []),
    ],
  })
    .select({ _id: 1 })
    .lean()

  return Boolean(captainMembership?._id)
}

export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: 'Необходима авторизация' },
      { status: 401 },
    )
  }

  const resolvedParams = await params
  const membershipId = toStringId(resolvedParams?.id)
  if (!membershipId) {
    return NextResponse.json(
      { success: false, error: 'Не указан идентификатор участника команды' },
      { status: 400 },
    )
  }

  try {
    const db = await dbConnectGlobal()
    if (!db) {
      throw new Error('Соединение с базой данных не установлено')
    }

    const TeamsUsersModel = db.model('TeamsUsers')
    const membership = await TeamsUsersModel.findById(membershipId)
      .select({ _id: 1, teamId: 1, role: 1, userId: 1, userTelegramId: 1 })
      .lean()
    if (!membership?._id) {
      return NextResponse.json(
        { success: false, error: 'Участник команды не найден' },
        { status: 404 },
      )
    }

    const actorRole = normalizeRole(session.user.role)
    const { actorUserId, actorTelegramId } = resolveActorIdentity(session)
    const allowed = await ensureCanManageMembership({
      db,
      actorRole,
      actorUserId,
      actorTelegramId,
      membership,
    })

    if (!allowed) {
      return NextResponse.json(
        { success: false, error: 'Недостаточно прав для удаления участника' },
        { status: 403 },
      )
    }

    const role = String(membership.role ?? '')
      .trim()
      .toLowerCase()
    const isCaptain = role === 'capitan'
    if (isCaptain && !isElevatedRole(actorRole)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Нельзя удалить капитана команды. Назначьте нового капитана.',
        },
        { status: 409 },
      )
    }

    await TeamsUsersModel.deleteOne({ _id: membershipId })

    return NextResponse.json(
      { success: true, data: { id: membershipId } },
      { status: 200 },
    )
  } catch (error) {
    console.error(
      'Failed to remove team membership via cabinet API (app)',
      error,
    )
    return NextResponse.json(
      { success: false, error: 'Не удалось удалить участника из команды' },
      { status: 500 },
    )
  }
}

export async function PUT(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: 'Необходима авторизация' },
      { status: 401 },
    )
  }

  const resolvedParams = await params
  const membershipId = toStringId(resolvedParams?.id)
  if (!membershipId) {
    return NextResponse.json(
      { success: false, error: 'Не указан идентификатор участника команды' },
      { status: 400 },
    )
  }

  const body = await request.json().catch(() => ({}))
  const payload = body?.data && typeof body.data === 'object' ? body.data : body
  const nextRole = String(payload?.role ?? '')
    .trim()
    .toLowerCase()
  if (nextRole !== 'capitan' && nextRole !== 'participant') {
    return NextResponse.json(
      { success: false, error: 'Некорректная роль участника' },
      { status: 400 },
    )
  }

  try {
    const db = await dbConnectGlobal()
    if (!db) {
      throw new Error('Соединение с базой данных не установлено')
    }

    const TeamsUsersModel = db.model('TeamsUsers')
    const membership = await TeamsUsersModel.findById(membershipId)
      .select({ _id: 1, teamId: 1, role: 1, userId: 1, userTelegramId: 1 })
      .lean()
    if (!membership?._id) {
      return NextResponse.json(
        { success: false, error: 'Участник команды не найден' },
        { status: 404 },
      )
    }

    const actorRole = normalizeRole(session.user.role)
    const { actorUserId, actorTelegramId } = resolveActorIdentity(session)
    const allowed = await ensureCanManageMembership({
      db,
      actorRole,
      actorUserId,
      actorTelegramId,
      membership,
    })

    if (!allowed) {
      return NextResponse.json(
        {
          success: false,
          error: 'Недостаточно прав для изменения роли участника',
        },
        { status: 403 },
      )
    }

    const updated = await TeamsUsersModel.findByIdAndUpdate(
      membershipId,
      { $set: { role: nextRole } },
      { returnDocument: 'after' },
    )
      .select({ _id: 1, teamId: 1, role: 1, userId: 1, userTelegramId: 1 })
      .lean()

    return NextResponse.json({ success: true, data: updated }, { status: 200 })
  } catch (error) {
    console.error(
      'Failed to update team membership via cabinet API (app)',
      error,
    )
    return NextResponse.json(
      { success: false, error: 'Не удалось обновить роль участника' },
      { status: 500 },
    )
  }
}
