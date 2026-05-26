import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import dbConnectGlobal from '@utils/dbConnectGlobal'
import { toStringId } from '@helpers/idAndDate'
import {
  TEAM_ROLE_CAPTAIN,
  isCaptainRole,
  isLiaisonRole,
  normalizeTeamRoleForWrite,
} from '@helpers/teamRoles'
import {
  canAddTargetUserToTeam,
  canJoinTeamForRole,
  isBannedSystemRole,
} from '@helpers/teamBanAccess'

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

  if (isBannedSystemRole(session.user.role)) {
    return NextResponse.json(
      {
        success: false,
        error: 'Заблокированный пользователь не может вступать в команды',
      },
      { status: 403 },
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
    console.log('[team-members][add][server] request_received', {
      teamId,
      targetUserId: toStringId(payload?.targetUserId),
      requestedRole,
      normalizedRole: role,
      actor: {
        role: session?.user?.role || null,
        globalUserId: session?.user?.globalUserId || null,
        id: session?.user?.id || null,
        _id: session?.user?._id || null,
      },
    })

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
      console.warn('[team-members][add][server] team_not_found', { teamId })
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
      console.warn('[team-members][add][server] actor_user_not_resolved', {
        actorRole,
      })
      return NextResponse.json(
        { success: false, error: 'Не удалось определить пользователя' },
        { status: 403 },
      )
    }

    // Режим добавления произвольного пользователя (только admin/dev)
    const targetUserIdRaw = toStringId(payload?.targetUserId)
    if (targetUserIdRaw) {
      console.log('[team-members][add][server] elevated_add_mode', {
        targetUserIdRaw,
        actorRole,
      })
      if (!isElevatedRole(actorRole)) {
        console.warn('[team-members][add][server] forbidden_not_elevated', {
          actorRole,
        })
        return NextResponse.json(
          {
            success: false,
            error: 'Добавлять других пользователей могут только администраторы',
          },
          { status: 403 },
        )
      }

      const targetUserDoc = await UsersModel.findOne({
        $or: [{ _id: targetUserIdRaw }, { globalUserId: targetUserIdRaw }],
      })
        .select({ globalUserId: 1, telegramId: 1, name: 1, username: 1, role: 1 })
        .lean()

      if (!targetUserDoc) {
        console.warn('[team-members][add][server] target_user_not_found', {
          targetUserIdRaw,
        })
        return NextResponse.json(
          { success: false, error: 'Пользователь не найден' },
          { status: 404 },
        )
      }

      if (
        !canAddTargetUserToTeam({
          actorRole,
          targetRole: targetUserDoc?.role,
        })
      ) {
        return NextResponse.json(
          {
            success: false,
            error: 'Заблокированного пользователя нельзя добавить в команду',
          },
          { status: 403 },
        )
      }

      const targetGlobalUserId = toStringId(
        targetUserDoc.globalUserId || targetUserDoc._id,
      )
      if (!targetGlobalUserId) {
        console.warn('[team-members][add][server] target_user_id_not_resolved', {
          targetUserIdRaw,
        })
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
        console.warn('[team-members][add][server] duplicate_membership', {
          teamId,
          targetGlobalUserId,
        })
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
      if (isLiaisonRole(role)) {
        await TeamsUsersModel.updateMany(
          {
            teamId,
            role,
            _id: { $ne: createdMembership._id },
          },
          { $set: { role: 'participant' } },
        )
      }
      console.log('[team-members][add][server] membership_created', {
        teamId,
        targetGlobalUserId,
        role,
        membershipId: toStringId(createdMembership?._id),
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
              userId: targetGlobalUserId,
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

    if (!isElevatedRole(actorRole) && (isCaptainRole(role) || isLiaisonRole(role))) {
      console.warn('[team-members][add][server] forbidden_set_captain', {
        actorRole,
      })
      return NextResponse.json(
        {
          success: false,
          error:
            'Назначать капитана или связного может только капитан команды',
        },
        { status: 403 },
      )
    }

    if (!isElevatedRole(actorRole) && team?.open === false) {
      console.warn('[team-members][add][server] forbidden_team_closed', {
        teamId,
      })
      return NextResponse.json(
        {
          success: false,
          error:
            'В этой команде закрыт набор. Попросите капитана добавить вас вручную.',
        },
        { status: 403 },
      )
    }

    if (!canJoinTeamForRole(session.user.role)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Заблокированный пользователь не может вступать в команды',
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
      console.warn('[team-members][add][server] actor_already_member', {
        teamId,
        actorUserId,
      })
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
    console.log('[team-members][add][server] self_membership_created', {
      teamId,
      actorUserId,
      role,
      membershipId: toStringId(createdMembership?._id),
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
