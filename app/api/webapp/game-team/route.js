import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import dbConnectGlobal from '@utils/dbConnectGlobal'
import { authOptions } from '@server/auth/authOptions'

const normalizeLocation = (value) => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

export async function GET(request) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.telegramId) {
    return NextResponse.json(
      { success: false, error: 'Необходимо войти через Telegram' },
      { status: 401 },
    )
  }

  const gameTeamId = request.nextUrl.searchParams.get('gameTeamId')
  const rawLocation = request.nextUrl.searchParams.get('location')

  if (!gameTeamId || typeof gameTeamId !== 'string') {
    return NextResponse.json(
      { success: false, error: 'Не указан идентификатор команды игры' },
      { status: 400 },
    )
  }

  const normalizedPreferredLocation =
    normalizeLocation(rawLocation) || normalizeLocation(session.user?.location)

  try {
    const db = await dbConnectGlobal()
    if (!db) {
      return NextResponse.json(
        { success: false, error: 'Глобальная база недоступна' },
        { status: 503 },
      )
    }

    const foundGameTeam = await db.model('GamesTeams').findById(gameTeamId).lean()
    if (!foundGameTeam) {
      return NextResponse.json(
        { success: false, error: 'Команда не найдена в игре' },
        { status: 404 },
      )
    }

    const gameId = foundGameTeam.gameId ? String(foundGameTeam.gameId) : null
    const teamId = foundGameTeam.teamId ? String(foundGameTeam.teamId) : null

    if (!gameId) {
      return NextResponse.json(
        { success: false, error: 'Игра не найдена для указанной команды' },
        { status: 404 },
      )
    }

    const gameDoc = await db
      .model('Games')
      .findById(gameId)
      .select({ _id: 1, location: 1 })
      .lean()
    const gameLocation = normalizeLocation(gameDoc?.location)
    const resolvedLocation = gameLocation || normalizedPreferredLocation || null

    if (
      normalizedPreferredLocation &&
      resolvedLocation &&
      normalizedPreferredLocation !== resolvedLocation
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'Команда игры не относится к выбранной площадке',
        },
        { status: 403 },
      )
    }

    return NextResponse.json(
      {
        success: true,
        gameTeam: {
          id: String(foundGameTeam._id),
          gameId,
          teamId,
          location: resolvedLocation || '',
        },
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('Failed to load game team info', error)
    return NextResponse.json(
      { success: false, error: 'Не удалось получить данные команды игры' },
      { status: 500 },
    )
  }
}
