import { getServerSession } from 'next-auth/next'

import { authOptions } from '@pages/api/auth/[...nextauth]'
import fetchTeamsForCabinet from '@helpers/fetchTeamsForCabinet'
import isUserAdmin from '@helpers/isUserAdmin'
import dbConnectGlobal from '@utils/dbConnectGlobal'

const parsePositiveInteger = (value, fallback) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric < 0) {
    return fallback
  }
  return Math.floor(numeric)
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

    const offset = parsePositiveInteger(req.query?.offset, 0)
    const limit = parsePositiveInteger(req.query?.limit, 10)

    const { teams, hasMore } = await fetchTeamsForCabinet({
      db,
      offset,
      limit,
      returnMeta: true,
    })

    return res.status(200).json({
      success: true,
      data: teams,
      meta: {
        offset,
        limit,
        hasMore,
      },
    })
  } catch (error) {
    console.error('Failed to load admin teams page', error)
    return res.status(500).json({ success: false, error: 'Не удалось загрузить список команд' })
  }
}
