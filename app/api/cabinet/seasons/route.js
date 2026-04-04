import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import dbConnectGlobal from '@utils/dbConnectGlobal'
import { LOCATIONS } from '@server/serverConstants'

const isGameManagerRole = (role) => {
  const normalized = typeof role === 'string' ? role.trim().toLowerCase() : ''
  return normalized === 'dev' || normalized === 'admin' || normalized === 'moder'
}

const normalizeLocation = (value) => {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return normalized || null
}

const normalizeName = (value) => {
  if (typeof value !== 'string') {
    return ''
  }

  return value.trim().replace(/\s+/g, ' ')
}

const normalizeSeason = (doc) => ({
  id: doc?._id ? String(doc._id) : '',
  name: typeof doc?.name === 'string' ? doc.name : '',
  location: typeof doc?.location === 'string' ? doc.location : '',
  createdAt: doc?.createdAt ? new Date(doc.createdAt).toISOString() : null,
  updatedAt: doc?.updatedAt ? new Date(doc.updatedAt).toISOString() : null,
})

export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user || !isGameManagerRole(session.user.role)) {
    return NextResponse.json(
      { success: false, error: 'Недостаточно прав' },
      { status: 403 },
    )
  }

  try {
    const db = await dbConnectGlobal()
    if (!db) {
      throw new Error('Не удалось подключиться к базе данных')
    }

    const requestUrl = new URL(request.url)
    const requestedLocation = normalizeLocation(requestUrl.searchParams.get('location'))
    const defaultLocation = normalizeLocation(session?.user?.location)
    const location = requestedLocation || defaultLocation

    if (!location || !LOCATIONS[location]) {
      return NextResponse.json(
        {
          success: false,
          error: 'Не передан корректный город сезона',
        },
        { status: 400 },
      )
    }

    const seasons = await db
      .model('Seasons')
      .find({ location })
      .sort({ nameLowered: 1, _id: 1 })
      .lean()

    return NextResponse.json(
      {
        success: true,
        data: seasons.map(normalizeSeason),
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('Failed to load seasons (app)', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Не удалось загрузить список сезонов',
      },
      { status: 500 },
    )
  }
}

export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user || !isGameManagerRole(session.user.role)) {
    return NextResponse.json(
      { success: false, error: 'Недостаточно прав' },
      { status: 403 },
    )
  }

  try {
    const db = await dbConnectGlobal()
    if (!db) {
      throw new Error('Не удалось подключиться к базе данных')
    }

    const payload = await request.json().catch(() => ({}))
    const location = normalizeLocation(payload?.location)
    const name = normalizeName(payload?.name)
    const nameLowered = name.toLowerCase()

    if (!location || !LOCATIONS[location]) {
      return NextResponse.json(
        {
          success: false,
          error: 'Не передан корректный город сезона',
        },
        { status: 400 },
      )
    }

    if (!name) {
      return NextResponse.json(
        {
          success: false,
          error: 'Укажите название сезона',
        },
        { status: 400 },
      )
    }

    const Seasons = db.model('Seasons')
    const existing = await Seasons.findOne({ location, nameLowered }).lean()
    if (existing) {
      return NextResponse.json(
        {
          success: true,
          data: normalizeSeason(existing),
          meta: { isExisting: true },
        },
        { status: 200 },
      )
    }

    const created = await Seasons.create({
      location,
      name,
      nameLowered,
    })

    return NextResponse.json(
      {
        success: true,
        data: normalizeSeason(created),
      },
      { status: 201 },
    )
  } catch (error) {
    console.error('Failed to create season (app)', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Не удалось создать сезон',
      },
      { status: 500 },
    )
  }
}
