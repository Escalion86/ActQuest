import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import fetchTeamsForCabinet from '@helpers/fetchTeamsForCabinet'
import isUserAdmin from '@helpers/isUserAdmin'
import dbConnectGlobal from '@utils/dbConnectGlobal'

export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user || !isUserAdmin({ role: session.user.role })) {
    return NextResponse.json(
      { success: false, error: 'Недостаточно прав' },
      { status: 403 },
    )
  }

  try {
    const requestUrl = new URL(request.url)
    const teamId =
      typeof requestUrl.searchParams.get('teamId') === 'string'
        ? requestUrl.searchParams.get('teamId').trim()
        : ''

    if (!teamId) {
      return NextResponse.json(
        { success: false, error: 'Не указан teamId' },
        { status: 400 },
      )
    }

    const db = await dbConnectGlobal()
    if (!db) {
      throw new Error('Не удалось подключиться к базе данных')
    }

    const location =
      typeof session?.user?.location === 'string' ? session.user.location : null

    const teams = await fetchTeamsForCabinet({
      db,
      teamIds: [teamId],
      location,
      sortBy: 'registration_desc',
      limit: 1,
      offset: 0,
    })

    const team = Array.isArray(teams) && teams.length > 0 ? teams[0] : null

    if (!team) {
      return NextResponse.json(
        { success: false, error: 'Команда не найдена' },
        { status: 404 },
      )
    }

    return NextResponse.json({ success: true, data: team }, { status: 200 })
  } catch (error) {
    console.error('Failed to load admin team details (app)', error)
    return NextResponse.json(
      { success: false, error: 'Не удалось загрузить команду' },
      { status: 500 },
    )
  }
}
