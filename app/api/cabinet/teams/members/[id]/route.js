import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import dbConnectGlobal from '@utils/dbConnectGlobal'
import { toStringId } from '@helpers/idAndDate'
import planTeamMembershipRoleUpdate from '@helpers/planTeamMembershipRoleUpdate'
import {
  getCaptainRoleQuery,
  isCaptainRole,
  isLiaisonRole,
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

const isSystemManagedTeam = async (db, teamId) => {
  if (!teamId) {
    return false
  }

  const team = await db
    .model('Teams')
    .findById(teamId)
    .select({ kind: 1 })
    .lean()

  return team?.kind === 'personal'
}

const resolveActorIdentity = (session) => {
  const actorUserId = toStringId(
    session?.user?.globalUserId ?? session?.user?.userId ?? session?.user?._id,
  )

  return { actorUserId }
}

const ensureCanManageMembership = async ({
  db,
  actorRole,
  actorUserId,
  membership,
}) => {
  if (isElevatedRole(actorRole)) {
    return true
  }

  const memberUserId = toStringId(membership?.userId)

  const isSelfMembership =
    actorUserId && memberUserId && actorUserId === memberUserId
  if (isSelfMembership) {
    return true
  }

  const TeamsUsersModel = db.model('TeamsUsers')
  const captainMembership = await TeamsUsersModel.findOne({
    teamId: membership.teamId,
    role: getCaptainRoleQuery(),
    userId: actorUserId,
  })
    .select({ _id: 1 })
    .lean()

  return Boolean(captainMembership?._id)
}

const ensureCanChangeRole = async ({ db, actorRole, actorUserId, teamId }) => {
  if (isElevatedRole(actorRole)) {
    return true
  }

  if (!actorUserId || !teamId) {
    return false
  }

  const captainMembership = await db
    .model('TeamsUsers')
    .findOne({
      teamId,
      role: getCaptainRoleQuery(),
      userId: actorUserId,
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

    if (await isSystemManagedTeam(db, membership.teamId)) {
      return NextResponse.json(
        { success: false, error: 'Персональная команда управляется системой' },
        { status: 403 },
      )
    }

    const actorRole = normalizeRole(session.user.role)
    const { actorUserId } = resolveActorIdentity(session)
    const allowed = await ensureCanManageMembership({
      db,
      actorRole,
      actorUserId,
      membership,
    })

    if (!allowed) {
      return NextResponse.json(
        { success: false, error: 'Недостаточно прав для удаления участника' },
        { status: 403 },
      )
    }

    const role = normalizeTeamRoleForWrite(membership.role)
    const isCaptain = isCaptainRole(role)
    if (isCaptain) {
      const teamMemberships = await TeamsUsersModel.find({
        teamId: membership.teamId,
      })
        .select({ _id: 1, role: 1 })
        .lean()
      const roleUpdatePlan = planTeamMembershipRoleUpdate({
        membershipId,
        memberships: teamMemberships,
        nextRole: 'participant',
      })

      if (!roleUpdatePlan.ok) {
        return NextResponse.json(
          {
            success: false,
            error:
              'Нельзя удалить последнего капитана команды. Назначьте нового капитана.',
          },
          { status: 409 },
        )
      }
    }

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
  const rawNextRole = String(payload?.role ?? '')
    .trim()
    .toLowerCase()
  if (
    rawNextRole !== 'captain' &&
    rawNextRole !== 'liaison' &&
    rawNextRole !== 'participant'
  ) {
    return NextResponse.json(
      { success: false, error: 'Некорректная роль участника' },
      { status: 400 },
    )
  }
  const nextRole = normalizeTeamRoleForWrite(rawNextRole)

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

    if (await isSystemManagedTeam(db, membership.teamId)) {
      return NextResponse.json(
        { success: false, error: 'Персональная команда управляется системой' },
        { status: 403 },
      )
    }

    const actorRole = normalizeRole(session.user.role)
    const { actorUserId } = resolveActorIdentity(session)
    const allowed = await ensureCanManageMembership({
      db,
      actorRole,
      actorUserId,
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

    const canChangeRole = await ensureCanChangeRole({
      db,
      actorRole,
      actorUserId,
      teamId: membership.teamId,
    })
    if (!canChangeRole) {
      return NextResponse.json(
        {
          success: false,
          error: 'Изменять роли участников может только капитан команды',
        },
        { status: 403 },
      )
    }

    if (isCaptainRole(membership.role) && isLiaisonRole(nextRole)) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Капитана нельзя назначить связным отдельной ролью. Если связной не назначен, капитан является связным по умолчанию.',
        },
        { status: 409 },
      )
    }

    const teamMemberships = await TeamsUsersModel.find({
      teamId: membership.teamId,
    })
      .select({ _id: 1, role: 1 })
      .lean()
    const roleUpdatePlan = planTeamMembershipRoleUpdate({
      membershipId,
      memberships: teamMemberships,
      nextRole,
    })

    if (!roleUpdatePlan.ok && roleUpdatePlan.code === 'captain_required') {
      return NextResponse.json(
        {
          success: false,
          error:
            'В команде должен оставаться хотя бы один капитан. Сначала назначьте нового капитана.',
        },
        { status: 409 },
      )
    }

    if (!roleUpdatePlan.ok) {
      return NextResponse.json(
        {
          success: false,
          error: 'Не удалось построить изменение роли участника',
        },
        { status: 409 },
      )
    }

    if (roleUpdatePlan.demoteCaptainIds.length > 0) {
      await TeamsUsersModel.updateMany(
        {
          teamId: membership.teamId,
          _id: { $in: roleUpdatePlan.demoteCaptainIds },
        },
        { $set: { role: 'participant' } },
      )
    }

    if (roleUpdatePlan.demoteLiaisonIds.length > 0) {
      await TeamsUsersModel.updateMany(
        {
          teamId: membership.teamId,
          _id: { $in: roleUpdatePlan.demoteLiaisonIds },
        },
        { $set: { role: 'participant' } },
      )
    }

    const updated = await TeamsUsersModel.findByIdAndUpdate(
      membershipId,
      { $set: { role: roleUpdatePlan.nextRole } },
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
