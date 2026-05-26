import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import isUserAdmin from '@helpers/isUserAdmin'
import dbConnectGlobal from '@utils/dbConnectGlobal'
import { applyWebUserBan } from '@server/webUserBan'
import {
  assertUserRoleMutationAllowed,
  buildUserUpdatePayload,
  normalizeRole,
} from '../../_lib/userAdminMutation'

export async function POST(request, { params }) {
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

    const UsersModel = db.model('Users')
    const existingUser = await UsersModel.findById(userId).select({ role: 1 }).lean()
    if (!existingUser) {
      return NextResponse.json(
        { success: false, error: 'Пользователь не найден' },
        { status: 404 },
      )
    }

    const roleMutationError = assertUserRoleMutationAllowed({
      actorRole: normalizeRole(session?.user?.role),
      targetCurrentRole: normalizeRole(existingUser?.role),
      targetNextRole: 'ban',
    })
    if (roleMutationError) {
      return NextResponse.json(
        { success: false, error: roleMutationError },
        { status: 403 },
      )
    }

    const body = await request.json().catch(() => ({}))
    const { payload, hasInvalidLocation } = buildUserUpdatePayload(body)
    if (hasInvalidLocation) {
      return NextResponse.json(
        { success: false, error: 'Некорректный город пользователя' },
        { status: 400 },
      )
    }

    const userPayload = { ...payload }
    delete userPayload.role
    await UsersModel.findByIdAndUpdate(userId, { $set: userPayload })

    const result = await applyWebUserBan({ db, userId })
    if (!result) {
      return NextResponse.json(
        { success: false, error: 'Пользователь не найден' },
        { status: 404 },
      )
    }

    const updatedUser = await UsersModel.findById(userId).lean()

    return NextResponse.json(
      {
        success: true,
        data: updatedUser,
        meta: {
          alreadyBanned: Boolean(result.alreadyBanned),
          summary: result.summary,
          teams: result.teams,
        },
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('Failed to ban user from cabinet web flow (app)', error)
    return NextResponse.json(
      { success: false, error: 'Не удалось заблокировать пользователя' },
      { status: 500 },
    )
  }
}
