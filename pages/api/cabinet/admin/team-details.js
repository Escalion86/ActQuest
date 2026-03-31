import { getServerSession } from 'next-auth/next'

import { authOptions } from '@pages/api/auth/[...nextauth]'
import fetchTeamsForCabinet from '@helpers/fetchTeamsForCabinet'
import isUserAdmin from '@helpers/isUserAdmin'
import dbConnectGlobal from '@utils/dbConnectGlobal'

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
    const teamId = typeof req.query?.teamId === 'string' ? req.query.teamId.trim() : ''

    if (!teamId) {
      return res.status(400).json({ success: false, error: 'Не указан teamId' })
    }

    const db = await dbConnectGlobal()
    if (!db) {
      throw new Error('Не удалось подключиться к базе данных')
    }

    const location = typeof session?.user?.location === 'string' ? session.user.location : null

    const teams = await fetchTeamsForCabinet({
      db,
      teamIds: [teamId],
      location,
      sortBy: 'registration_desc',
      limit: 1,
      offset: 0,
    })

    const team = Array.isArray(teams) && teams.length > 0 ? teams[0] : null

    if (!team) {
      return res.status(404).json({ success: false, error: 'Команда не найдена' })
    }

    return res.status(200).json({ success: true, data: team })
  } catch (error) {
    console.error('Failed to load admin team details', error)
    return res.status(500).json({ success: false, error: 'Не удалось загрузить команду' })
  }
}
