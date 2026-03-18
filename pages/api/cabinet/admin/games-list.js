import { getServerSession } from 'next-auth/next'

import { authOptions } from '@pages/api/auth/[...nextauth]'
import isUserAdmin from '@helpers/isUserAdmin'
import dbConnectGlobal from '@utils/dbConnectGlobal'

const parsePositiveInteger = (value, fallback) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric < 0) {
    return fallback
  }
  return Math.floor(numeric)
}

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const normalizeLocation = (value) => {
  if (typeof value !== 'string') {
    return ''
  }
  return value.trim().toLowerCase()
}

const buildQuery = ({ location, search }) => {
  const query = {}
  const normalizedLocation = normalizeLocation(location)
  const normalizedSearch =
    typeof search === 'string' ? search.trim() : ''

  if (normalizedLocation) {
    query.location = normalizedLocation
  }

  if (normalizedSearch) {
    const regex = new RegExp(escapeRegExp(normalizedSearch), 'i')
    query.$or = [{ name: regex }, { location: regex }]
  }

  return query
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).json({ success: false, error: 'Метод не поддерживается' })
  }

  const session = await getServerSession(req, res, authOptions)
  if (!session?.user || !isUserAdmin({ role: session.user.role })) {
    return res.status(403).json({ success: false, error: 'Недостаточно прав' })
  }

  try {
    const db = await dbConnectGlobal()
    if (!db) {
      throw new Error('Не удалось подключиться к базе данных')
    }

    const Games = db.model('Games')
    const offset = parsePositiveInteger(req.query?.offset, 0)
    const limit = parsePositiveInteger(req.query?.limit, 10)
    const query = buildQuery({
      location: req.query?.location,
      search: req.query?.q,
    })

    const docs = await Games.find(query)
      .sort({ dateStart: -1, updatedAt: -1 })
      .skip(offset)
      .limit(limit + 1)
      .select({
        _id: 1,
        name: 1,
        location: 1,
        dateStart: 1,
        status: 1,
      })
      .lean()

    const hasMore = docs.length > limit
    const data = hasMore ? docs.slice(0, limit) : docs

    return res.status(200).json({
      success: true,
      data: data.map((item) => ({
        id: item?._id ? String(item._id) : null,
        name: typeof item?.name === 'string' ? item.name : '',
        location: typeof item?.location === 'string' ? item.location : '',
        dateStart: item?.dateStart ?? null,
        status: typeof item?.status === 'string' ? item.status : '',
      })),
      meta: {
        offset,
        limit,
        hasMore,
      },
    })
  } catch (error) {
    console.error('Failed to load admin games list', error)
    return res.status(500).json({ success: false, error: 'Не удалось загрузить список игр' })
  }
}
