import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import isUserAdmin from '@helpers/isUserAdmin'
import { toStringId } from '@helpers/idAndDate'
import dbConnectGlobal from '@utils/dbConnectGlobal'

const normalizeTelegramId = (value) => {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

const resolveTeamNameMap = (teams) => {
  const entries = Array.isArray(teams) ? teams : []
  return entries.reduce((acc, team) => {
    const teamId = toStringId(team?._id)
    if (!teamId) {
      return acc
    }

    acc[teamId] =
      typeof team?.name === 'string' && team.name.trim()
        ? team.name.trim()
        : 'Без названия'
    return acc
  }, {})
}

export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user || !isUserAdmin({ role: session.user.role })) {
    return NextResponse.json(
      { success: false, error: 'Недостаточно прав' },
      { status: 403 },
    )
  }

  const requestUrl = new URL(request.url)
  const userId =
    typeof requestUrl.searchParams.get('userId') === 'string'
      ? requestUrl.searchParams.get('userId').trim()
      : ''
  const telegramId = normalizeTelegramId(requestUrl.searchParams.get('telegramId'))

  if (!userId && telegramId === null) {
    return NextResponse.json(
      {
        success: false,
        error: 'Не переданы идентификаторы пользователя',
      },
      { status: 400 },
    )
  }

  try {
    const db = await dbConnectGlobal()
    if (!db) {
      throw new Error('Не удалось подключиться к базе данных')
    }

    const orConditions = []
    if (userId) {
      orConditions.push({ 'result.teamsUsers.userId': userId })
    }
    if (telegramId !== null) {
      orConditions.push({ 'result.teamsUsers.userTelegramId': telegramId })
    }

    const games = await db
      .model('Games')
      .find({
        status: 'closed',
        $or: orConditions,
      })
      .select({
        _id: 1,
        name: 1,
        status: 1,
        location: 1,
        dateStart: 1,
        result: 1,
      })
      .sort({ dateStart: -1, _id: -1 })
      .lean()

    const normalizedGames = games.map((game) => {
      const teamsUsers = Array.isArray(game?.result?.teamsUsers)
        ? game.result.teamsUsers
        : []
      const teamNameMap = resolveTeamNameMap(game?.result?.teams)
      const userTeamIds = new Set()

      teamsUsers.forEach((membership) => {
        const membershipUserId = toStringId(membership?.userId)
        const membershipTelegramId = normalizeTelegramId(membership?.userTelegramId)

        const byUserId = userId && membershipUserId === userId
        const byTelegram = telegramId !== null && membershipTelegramId === telegramId
        if (!byUserId && !byTelegram) {
          return
        }

        const teamId = toStringId(membership?.teamId)
        if (teamId) {
          userTeamIds.add(teamId)
        }
      })

      const teams = Array.from(userTeamIds).map(
        (teamId) => teamNameMap[teamId] || 'Без названия',
      )
      const teamsPlaces =
        game?.result?.teamsPlaces && typeof game.result.teamsPlaces === 'object'
          ? game.result.teamsPlaces
          : {}
      const places = Array.from(userTeamIds)
        .map((teamId) => Number(teamsPlaces[teamId]))
        .filter((value) => Number.isFinite(value))
      const place = places.length > 0 ? Math.min(...places) : null

      return {
        id: toStringId(game?._id) || '',
        name: typeof game?.name === 'string' ? game.name : 'Без названия',
        status: typeof game?.status === 'string' ? game.status : '',
        location: typeof game?.location === 'string' ? game.location : '',
        dateStart: game?.dateStart ? new Date(game.dateStart).toISOString() : null,
        teams,
        place,
      }
    })

    return NextResponse.json(
      {
        success: true,
        data: normalizedGames,
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('Failed to load user participation games (app)', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Не удалось загрузить игры участия пользователя',
      },
      { status: 500 },
    )
  }
}
