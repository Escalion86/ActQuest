import { getServerSession } from 'next-auth/next'

import { authOptions } from '@pages/api/auth/[...nextauth]'
import fetchTeamsForCabinet from '@helpers/fetchTeamsForCabinet'
import isUserAdmin from '@helpers/isUserAdmin'
import dbConnectGlobal from '@utils/dbConnectGlobal'

const normalizeRole = (value) => {
  if (typeof value !== 'string') {
    return 'client'
  }

  const normalized = value.trim().toLowerCase()
  if (normalized === 'moderator') {
    return 'moder'
  }

  if (['client', 'moder', 'admin', 'dev'].includes(normalized)) {
    return normalized
  }

  return 'client'
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).json({ success: false, error: 'Метод не поддерживается' })
  }

  const session = await getServerSession(req, res, authOptions)
  if (!session?.user) {
    return res.status(401).json({ success: false, error: 'Требуется авторизация' })
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

    const role = normalizeRole(session?.user?.role)
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

    const isAdmin = isUserAdmin({ role })
    const currentUserId = typeof session?.user?._id === 'string' ? session.user._id : null
    const currentUserTelegramId = Number.isFinite(Number(session?.user?.telegramId))
      ? String(Number(session.user.telegramId))
      : null

    const isMember = Array.isArray(team.members)
      ? team.members.some((member) => {
          const memberUserId = typeof member?.userId === 'string' ? member.userId : null
          const memberTelegramId = typeof member?.telegramId === 'string' ? member.telegramId : null
          return (
            (currentUserId && memberUserId && memberUserId === currentUserId) ||
            (currentUserTelegramId && memberTelegramId && memberTelegramId === currentUserTelegramId)
          )
        })
      : false

    if (!isAdmin && !isMember && !team.open) {
      return res.status(403).json({ success: false, error: 'Недостаточно прав для просмотра команды' })
    }

    return res.status(200).json({ success: true, data: team })
  } catch (error) {
    console.error('Failed to load cabinet team details', error)
    return res.status(500).json({ success: false, error: 'Не удалось загрузить команду' })
  }
}
