import dbConnectGlobal from '@utils/dbConnectGlobal'
import { NextResponse } from 'next/server'

// Публичный endpoint для лендинга — возвращает только безопасные данные
// Заменяет /api/[location]/custom для публичных запросов

const ALLOWED_GAME_FIELDS = [
  '_id',
  'name',
  'image',
  'location',
  'dateStart',
  'dateEndFact',
  'status',
  'hidden',
]

const ALLOWED_SETTINGS_FIELDS = ['chatUrl', 'chatUrlsByLocation']

const MAX_LIMIT = 120

function buildSelect(selectParam, allowedFields) {
  if (!selectParam) return allowedFields.join(' ')
  const requested = selectParam.split(',').map((s) => s.trim())
  return requested.filter((f) => allowedFields.includes(f)).join(' ') || '_id'
}

export async function GET(request) {
  const { searchParams } = request.nextUrl
  const type = searchParams.get('type')
  const location = searchParams.get('location')
  const sort = searchParams.get('sort') || 'dateStart'
  const limit = Math.min(
    parseInt(searchParams.get('limit') || '50', 10) || 50,
    MAX_LIMIT,
  )
  const select = searchParams.get('select')

  if (!location || typeof location !== 'string') {
    return NextResponse.json(
      { success: false, error: 'Не указана площадка' },
      { status: 400 },
    )
  }

  try {
    const db = await dbConnectGlobal()
    if (!db) {
      return NextResponse.json(
        { success: false, error: 'Нет подключения к БД' },
        { status: 503 },
      )
    }

    if (type === 'settings') {
      const selectStr = buildSelect(select, ALLOWED_SETTINGS_FIELDS)
      const data = await db
        .model('SiteSettings')
        .find({})
        .select(selectStr)
        .limit(1)
        .lean()
      return NextResponse.json({ success: true, data })
    }

    // По умолчанию — games
    const selectStr = buildSelect(select, ALLOWED_GAME_FIELDS)
    const data = await db
      .model('Games')
      .find({ location })
      .select(selectStr)
      .sort(sort)
      .limit(limit)
      .lean()

    return NextResponse.json({ success: true, data })
  } catch (_error) {
    return NextResponse.json(
      { success: false, error: 'Ошибка запроса' },
      { status: 500 },
    )
  }
}
