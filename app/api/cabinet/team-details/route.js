import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import {
  buildRatingPeriods,
  loadLocationSeasons,
  loadTeamsRatingBreakdown,
} from '@app/cabinet/_lib/ratingServerData'
import fetchTeamsForCabinet from '@helpers/fetchTeamsForCabinet'
import isUserAdmin from '@helpers/isUserAdmin'
import dbConnectGlobal from '@utils/dbConnectGlobal'

const normalizeRole = (value) => {
  if (typeof value !== 'string') {
    return 'client'
  }

  const normalized = value.trim().toLowerCase()
  if (['client', 'moder', 'admin', 'dev'].includes(normalized)) {
    return normalized
  }

  return 'client'
}

export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: 'Требуется авторизация' },
      { status: 401 },
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

    const role = normalizeRole(session?.user?.role)
    const teams = await fetchTeamsForCabinet({
      db,
      teamIds: [teamId],
      // Для запроса конкретной команды по teamId не фильтруем по городу сессии,
      // иначе команда из другого города может "пропадать".
      location: null,
      teamLocationFilter: 'all',
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

    const isAdmin = isUserAdmin({ role })
    const currentUserId =
      typeof session?.user?._id === 'string' ? session.user._id : null

    const isMember = Array.isArray(team.members)
      ? team.members.some((member) => {
          const memberUserId =
            typeof member?.userId === 'string' ? member.userId : null
          return currentUserId && memberUserId && memberUserId === currentUserId
        })
      : false

    if (!isAdmin && !isMember && !team.open) {
      return NextResponse.json(
        { success: false, error: 'Недостаточно прав для просмотра команды' },
        { status: 403 },
      )
    }

    const ratingLocation =
      typeof team.location === 'string'
        ? team.location.trim().toLowerCase()
        : ''
    const [ratingTeamDoc, seasons, breakdownByTeamId] = await Promise.all([
      db
        .model('Teams')
        .findById(teamId)
        .select({ rating: 1, ratingsByLocation: 1, ratingsBySeason: 1 })
        .lean(),
      loadLocationSeasons({ db, location: ratingLocation }),
      loadTeamsRatingBreakdown({
        db,
        teamIds: [teamId],
        location: ratingLocation,
        seasonId: null,
      }),
    ])
    const ratingPeriods = buildRatingPeriods({
      document: ratingTeamDoc,
      location: ratingLocation,
      seasons,
      breakdown: breakdownByTeamId.get(teamId) || [],
    })
    const teamWithRatingDetails = {
      ...team,
      rating: ratingPeriods[0]?.rating || team.rating,
      ratingPeriods,
    }

    return NextResponse.json(
      { success: true, data: teamWithRatingDetails },
      { status: 200 },
    )
  } catch (error) {
    console.error('Failed to load cabinet team details (app)', error)
    return NextResponse.json(
      { success: false, error: 'Не удалось загрузить команду' },
      { status: 500 },
    )
  }
}

