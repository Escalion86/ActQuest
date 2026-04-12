import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import dbConnectGlobal from '@utils/dbConnectGlobal'
import { toStringId } from '@helpers/idAndDate'
import {
  TEAM_ROLE_CAPTAIN,
  isCaptainRole,
  normalizeTeamRoleForWrite,
} from '@helpers/teamRoles'

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
  const role = normalizeTeamRoleForWrite(requestedRole)

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
    const UsersModel = db.model('Users')

    const team = await TeamsModel.findById(teamId)
      .select({ _id: 1, open: 1 })
      .lean()
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

    if (!actorUserId) {
      return NextResponse.json(
        { success: false, error: 'Не удалось определить пользователя' },
        { status: 403 },
      )
    }

    // Режим добавления произвольного пользователя (только admin/dev)
    const targetUserIdRaw = toStringId(payload?.targetUserId)
    if (targetUserIdRaw) {
      if (!isElevatedRole(actorRole)) {
        return NextResponse.json(
          {
            success: false,
            error: 'Добавлять других пользователей могут только администраторы',
          },
          { status: 403 },
        )
      }

      const targetUserDoc = await UsersModel.findOne({
        globalUserId: targetUserIdRaw,
      })
        .select({ globalUserId: 1, telegramId: 1, name: 1, username: 1 })
        .lean()

      if (!targetUserDoc) {
        return NextResponse.json(
          { success: false, error: 'Пользователь не найден' },
          { status: 404 },
        )
      }

      const targetGlobalUserId = toStringId(targetUserDoc.globalUserId)
      if (!targetGlobalUserId) {
        return NextResponse.json(
          { success: false, error: 'Не удалось идентифицировать пользователя' },
          { status: 400 },
        )
      }

      const existingMembership = await TeamsUsersModel.findOne({
        teamId,
        userId: targetGlobalUserId,
      })
        .select({ _id: 1 })
        .lean()
      if (existingMembership?._id) {
        return NextResponse.json(
          { success: false, error: 'Пользователь уже состоит в этой команде' },
          { status: 409 },
        )
      }

      const createdMembership = await TeamsUsersModel.create({
        teamId,
        userId: targetGlobalUserId,
        role,
      })

      return NextResponse.json(
        {
          success: true,
          data: {
            id: toStringId(createdMembership?._id),
            teamId,
            role,
            member: {
              id: toStringId(createdMembership?._id),
              name: targetUserDoc.name || null,
              username: targetUserDoc.username || null,
              isCaptain: role === TEAM_ROLE_CAPTAIN,
              hasLinkedUser: true,
            },
          },
        },
        { status: 201 },
      )
    }

    if (!isElevatedRole(actorRole) && isCaptainRole(role)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Назначать капитана может только капитан команды',
        },
        { status: 403 },
      )
    }

    if (!isElevatedRole(actorRole) && team?.open === false) {
      return NextResponse.json(
        {
          success: false,
          error:
            'В этой команде закрыт набор. Попросите капитана добавить вас вручную.',
        },
        { status: 403 },
      )
    }

    const membershipFilter = {
      teamId,
      userId: actorUserId,
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
