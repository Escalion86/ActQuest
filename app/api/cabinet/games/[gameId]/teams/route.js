import { NextResponse } from 'next/server'

import fetchTeamsForCabinet from '@helpers/fetchTeamsForCabinet'
import dbConnectGlobal from '@utils/dbConnectGlobal'

const toStringId = (value) => {
  if (value === null || value === undefined) {
    return null
  }

  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'number') {
    return value.toString()
  }

  if (typeof value.toString === 'function') {
    const result = value.toString()
    return result === '[object Object]' ? null : result
  }

  return null
}

const normalizeGameTeamEntry = (doc) => {
  const id = toStringId(doc?._id ?? doc?.id)
  const teamId = toStringId(doc?.teamId)

  if (!id || !teamId) {
    return null
  }

  return { id, teamId }
}

export async function GET(request, { params }) {
  const requestUrl = new URL(request.url)
  const { gameId } = params
  const location = requestUrl.searchParams.get('location')

  if (!location || typeof location !== 'string') {
    return NextResponse.json(
      { success: false, error: 'Не передана площадка' },
      { status: 400 },
    )
  }

  const normalizedGameId = toStringId(gameId)

  if (
    !normalizedGameId ||
    normalizedGameId === 'undefined' ||
    normalizedGameId === 'null'
  ) {
    return NextResponse.json(
      { success: false, error: 'Не передан идентификатор игры' },
      { status: 400 },
    )
  }

  try {
    const db = await dbConnectGlobal()

    if (!db) {
      throw new Error('Соединение с базой данных не установлено')
    }

    const game = await db
      .model('Games')
      .findById(normalizedGameId)
      .select({ _id: 1, location: 1 })
      .lean()

    if (!game) {
      return NextResponse.json(
        { success: false, error: 'Игра не найдена' },
        { status: 404 },
      )
    }

    const gameLocation =
      typeof game.location === 'string'
        ? game.location.trim().toLowerCase()
        : null
    const requestedLocation = location.trim().toLowerCase()
    if (gameLocation && requestedLocation && gameLocation !== requestedLocation) {
      return NextResponse.json(
        { success: false, error: 'Игра недоступна для выбранной площадки' },
        { status: 403 },
      )
    }

    const GamesTeamsModel = db.model('GamesTeams')
    const gameTeamsDocs = await GamesTeamsModel.find({ gameId: normalizedGameId })
      .select({ _id: 1, teamId: 1 })
      .lean()

    const entries = Array.isArray(gameTeamsDocs)
      ? gameTeamsDocs.map((doc) => normalizeGameTeamEntry(doc)).filter(Boolean)
      : []

    const uniqueTeamIds = Array.from(new Set(entries.map((entry) => entry.teamId)))

    const teams = uniqueTeamIds.length
      ? await fetchTeamsForCabinet({
          db,
          teamIds: uniqueTeamIds,
          location: requestedLocation,
        })
      : []

    return NextResponse.json(
      {
        success: true,
        data: {
          entries,
          teams,
        },
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('Failed to load game teams for cabinet (app)', error)
    return NextResponse.json(
      { success: false, error: 'Не удалось загрузить команды игры' },
      { status: 500 },
    )
  }
}
