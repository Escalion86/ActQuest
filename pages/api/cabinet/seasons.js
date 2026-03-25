import { getServerSession } from 'next-auth/next'

import { authOptions } from '@pages/api/auth/[...nextauth]'
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

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user || !isGameManagerRole(session.user.role)) {
    return res.status(403).json({ success: false, error: 'Недостаточно прав' })
  }

  if (req.method === 'GET') {
    try {
      const db = await dbConnectGlobal()
      if (!db) {
        throw new Error('Не удалось подключиться к базе данных')
      }

      const requestedLocation = normalizeLocation(req.query?.location)
      const defaultLocation = normalizeLocation(session?.user?.location)
      const location = requestedLocation || defaultLocation

      if (!location || !LOCATIONS[location]) {
        return res.status(400).json({
          success: false,
          error: 'Не передан корректный город сезона',
        })
      }

      const seasons = await db.model('Seasons').find({ location })
        .sort({ nameLowered: 1, _id: 1 })
        .lean()

      return res.status(200).json({
        success: true,
        data: seasons.map(normalizeSeason),
      })
    } catch (error) {
      console.error('Failed to load seasons', error)
      return res.status(500).json({
        success: false,
        error: 'Не удалось загрузить список сезонов',
      })
    }
  }

  if (req.method === 'POST') {
    try {
      const db = await dbConnectGlobal()
      if (!db) {
        throw new Error('Не удалось подключиться к базе данных')
      }

      const location = normalizeLocation(req.body?.location)
      const name = normalizeName(req.body?.name)
      const nameLowered = name.toLowerCase()

      if (!location || !LOCATIONS[location]) {
        return res.status(400).json({
          success: false,
          error: 'Не передан корректный город сезона',
        })
      }

      if (!name) {
        return res.status(400).json({
          success: false,
          error: 'Укажите название сезона',
        })
      }

      const Seasons = db.model('Seasons')
      const existing = await Seasons.findOne({ location, nameLowered }).lean()
      if (existing) {
        return res.status(200).json({
          success: true,
          data: normalizeSeason(existing),
          meta: { isExisting: true },
        })
      }

      const created = await Seasons.create({
        location,
        name,
        nameLowered,
      })

      return res.status(201).json({
        success: true,
        data: normalizeSeason(created),
      })
    } catch (error) {
      console.error('Failed to create season', error)
      return res.status(500).json({
        success: false,
        error: 'Не удалось создать сезон',
      })
    }
  }

  res.setHeader('Allow', ['GET', 'POST'])
  return res.status(405).json({ success: false, error: 'Метод не поддерживается' })
}
