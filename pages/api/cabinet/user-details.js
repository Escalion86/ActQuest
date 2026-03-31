import { getServerSession } from 'next-auth/next'

import { authOptions } from '@pages/api/auth/[...nextauth]'
import ensureRole from '@helpers/ensureRole'
import normalizeUserProfile from '@helpers/normalizeUserProfile'
import { ensureDateISOString, toStringId } from '@helpers/idAndDate'
import isUserAdmin from '@helpers/isUserAdmin'
import dbConnectGlobal from '@utils/dbConnectGlobal'

const normalizeTelegramId = (value) => {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

const normalizeMembershipRole = (value) => (value === 'capitan' ? 'capitan' : 'participant')

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
    const userId = typeof req.query?.userId === 'string' ? req.query.userId.trim() : ''
    const telegramId = normalizeTelegramId(req.query?.telegramId)

    if (!userId && telegramId === null) {
      return res.status(400).json({ success: false, error: 'Не передан userId или telegramId' })
    }

    const db = await dbConnectGlobal()
    if (!db) {
      throw new Error('Не удалось подключиться к базе данных')
    }

    const UsersModel = db.model('Users')
    const TeamsUsersModel = db.model('TeamsUsers')
    const TeamsModel = db.model('Teams')

    const query = userId
      ? { _id: userId }
      : { telegramId }

    const userDoc = await UsersModel.findOne(query).lean()
    if (!userDoc) {
      return res.status(404).json({ success: false, error: 'Пользователь не найден' })
    }

    const userTelegramId = normalizeTelegramId(userDoc?.telegramId)
    const memberships = userTelegramId !== null
      ? await TeamsUsersModel.find({ userTelegramId: userTelegramId })
          .select({ teamId: 1, role: 1 })
          .lean()
      : []

    const teamIds = Array.from(
      new Set(memberships.map((doc) => toStringId(doc?.teamId)).filter(Boolean))
    )

    const teamsDocs = teamIds.length
      ? await TeamsModel.find({ _id: { $in: teamIds } })
          .select({ _id: 1, name: 1, image: 1, updatedAt: 1, gameStats: 1 })
          .lean()
      : []

    const teamsById = teamsDocs.reduce((acc, team) => {
      const id = toStringId(team?._id)
      if (!id) {
        return acc
      }

      acc[id] = {
        id,
        name: typeof team?.name === 'string' ? team.name : '',
        image: typeof team?.image === 'string' ? team.image : '',
        updatedAt: ensureDateISOString(team?.updatedAt),
        gamesCount: Number.isFinite(Number(team?.gameStats?.playedGamesCount))
          ? Number(team.gameStats.playedGamesCount)
          : 0,
      }
      return acc
    }, {})

    const teams = memberships
      .map((membership) => {
        const teamId = toStringId(membership?.teamId)
        if (!teamId || !teamsById[teamId]) {
          return null
        }

        const team = teamsById[teamId]
        const role = normalizeMembershipRole(membership?.role)

        return {
          ...team,
          role,
          isCaptain: role === 'capitan',
        }
      })
      .filter(Boolean)

    const profile = normalizeUserProfile(userDoc)
    const role = ensureRole(userDoc?.role)
    const isAdmin = isUserAdmin({ role: session?.user?.role })

    const payload = {
      ...profile,
      id: toStringId(userDoc?._id),
      globalUserId: userDoc?.globalUserId ? String(userDoc.globalUserId) : null,
      telegramId: userTelegramId !== null ? String(userTelegramId) : '',
      role,
      createdAt: ensureDateISOString(userDoc?.createdAt),
      updatedAt: ensureDateISOString(userDoc?.updatedAt),
      teams,
      teamsCount: teams.length,
      gamesCount: Number.isFinite(Number(userDoc?.gameStats?.playedGamesCount))
        ? Number(userDoc.gameStats.playedGamesCount)
        : 0,
      rating: userDoc?.rating && typeof userDoc.rating === 'object'
        ? userDoc.rating
        : null,
    }

    if (!isAdmin) {
      payload.phone = ''
    }

    return res.status(200).json({ success: true, data: payload })
  } catch (error) {
    console.error('Failed to load cabinet user details', error)
    return res.status(500).json({ success: false, error: 'Не удалось загрузить пользователя' })
  }
}
