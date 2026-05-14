import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import { buildAgentGameStatus } from '@server/agentGameStatus'
import dbConnectGlobal from '@utils/dbConnectGlobal'

const normalizeStringId = (value) => {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value?.toString === 'function') {
    const nextValue = value.toString()
    return nextValue === '[object Object]' ? '' : nextValue.trim()
  }
  return ''
}

const resolveSessionUserId = (sessionUser) =>
  normalizeStringId(
    sessionUser?.globalUserId ??
      sessionUser?.userId ??
      sessionUser?._id ??
      sessionUser?.id,
  )

export async function GET(request) {
  const session = await getServerSession(authOptions)
  const userId = resolveSessionUserId(session?.user)
  const role =
    typeof session?.user?.role === 'string'
      ? session.user.role.trim().toLowerCase()
      : ''

  if (!session?.user || !userId) {
    return NextResponse.json(
      { success: false, error: 'Необходима авторизация' },
      { status: 401 },
    )
  }

  if (!['agent', 'moder', 'admin', 'dev'].includes(role)) {
    return NextResponse.json(
      { success: false, error: 'Недостаточно прав' },
      { status: 403 },
    )
  }

  const requestUrl = new URL(request.url)
  const gameId = requestUrl.searchParams.get('gameId')
  if (!gameId) {
    return NextResponse.json(
      { success: false, error: 'Не указан идентификатор игры' },
      { status: 400 },
    )
  }

  try {
    const db = await dbConnectGlobal()
    if (!db) {
      throw new Error('Не удалось подключиться к базе данных')
    }

    const result = await buildAgentGameStatus({ db, gameId, userId, role })
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.statusCode || 500 },
      )
    }

    return NextResponse.json(
      { success: true, data: result.data },
      { status: 200 },
    )
  } catch (error) {
    console.error('Failed to load agent game status', error)
    return NextResponse.json(
      { success: false, error: 'Не удалось загрузить статус игры агента' },
      { status: 500 },
    )
  }
}
