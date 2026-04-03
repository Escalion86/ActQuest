import { NextResponse } from 'next/server'

import fetchTeamsForCabinet from '@helpers/fetchTeamsForCabinet'
import dbConnectGlobal from '@utils/dbConnectGlobal'

const collectTeamIds = (searchParams) => {
  const rawIds = []
  const appendValue = (value) => {
    if (!value) {
      return
    }

    if (Array.isArray(value)) {
      value.forEach((item) => appendValue(item))
      return
    }

    if (typeof value === 'string') {
      value
        .split(',')
        .map((item) => item.trim())
        .filter(
          (item) => item.length > 0 && item !== 'undefined' && item !== 'null',
        )
        .forEach((item) => rawIds.push(item))
    }
  }

  appendValue(searchParams.getAll('teamIds'))
  appendValue(searchParams.get('teamIds'))
  appendValue(searchParams.getAll('teamId'))
  appendValue(searchParams.get('teamId'))

  return Array.from(new Set(rawIds))
}

export async function GET(request) {
  const requestUrl = new URL(request.url)
  const teamIds = collectTeamIds(requestUrl.searchParams)
  const location = requestUrl.searchParams.get('location')

  if (teamIds.length === 0) {
    return NextResponse.json(
      { success: false, error: 'Не переданы идентификаторы команд' },
      { status: 400 },
    )
  }

  try {
    const db = await dbConnectGlobal()

    if (!db) {
      throw new Error('Соединение с базой данных не установлено')
    }

    const teams = await fetchTeamsForCabinet({
      db,
      teamIds,
      location: typeof location === 'string' ? location : null,
    })

    return NextResponse.json(
      {
        success: true,
        data: teams,
        meta: { location: typeof location === 'string' ? location : null },
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('Failed to load cabinet teams via app router API pilot', error)
    return NextResponse.json(
      { success: false, error: 'Не удалось загрузить команды' },
      { status: 500 },
    )
  }
}

