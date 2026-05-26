import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import isUserAdmin from '@helpers/isUserAdmin'
import dbConnectGlobal from '@utils/dbConnectGlobal'
import { buildWebUserBanPreview } from '@server/webUserBan'
import {
  assertUserRoleMutationAllowed,
  normalizeRole,
} from '../../_lib/userAdminMutation'

export async function POST(_request, { params }) {
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

    const preview = await buildWebUserBanPreview({ db, userId })
    if (!preview) {
      return NextResponse.json(
        { success: false, error: 'Пользователь не найден' },
        { status: 404 },
      )
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          ...preview,
          alreadyBanned: normalizeRole(preview?.user?.role) === 'ban',
        },
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('Failed to build user ban preview (app)', error)
    return NextResponse.json(
      { success: false, error: 'Не удалось подготовить подтверждение бана' },
      { status: 500 },
    )
  }
}

