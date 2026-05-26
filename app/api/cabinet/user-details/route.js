import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import ensureRole from '@helpers/ensureRole'
import normalizeUserProfile from '@helpers/normalizeUserProfile'
import { ensureDateISOString, toStringId } from '@helpers/idAndDate'
import isUserAdmin from '@helpers/isUserAdmin'
import {
  isCaptainRole,
  normalizeTeamRoleForWrite,
} from '@helpers/teamRoles'
import dbConnectGlobal from '@utils/dbConnectGlobal'

const normalizeTelegramId = (value) => {
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric !== 0 ? numeric : null
}

const collectUserIdCandidates = (user) =>
  Array.from(
    new Set(
      [
        toStringId(user?._id),
        toStringId(user?.id),
        toStringId(user?.userId),
        toStringId(user?.globalUserId),
      ].filter(Boolean),
    ),
  )

const resolveMembershipsByUserIds = async ({ TeamsUsersModel, userIds }) => {
  if (!Array.isArray(userIds) || userIds.length === 0) {
    return []
  }

  return TeamsUsersModel.find({ userId: { $in: userIds } })
    .select({ teamId: 1, role: 1 })
    .lean()
}

export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: 'Требуется авторизация' },
      { status: 401 },
    )
  }

  try {
    const requestUrl = new URL(request.url)
    const userId =
      typeof requestUrl.searchParams.get('userId') === 'string'
        ? requestUrl.searchParams.get('userId').trim()
        : ''
    const telegramId = normalizeTelegramId(
      requestUrl.searchParams.get('telegramId'),
    )

    if (!userId && telegramId === null) {
      return NextResponse.json(
        { success: false, error: 'Не передан userId или telegramId' },
        { status: 400 },
      )
    }

    const db = await dbConnectGlobal()
    if (!db) {
      throw new Error('Не удалось подключиться к базе данных')
    }

    const UsersModel = db.model('Users')
    const TeamsUsersModel = db.model('TeamsUsers')
    const TeamsModel = db.model('Teams')

    const query = userId ? { _id: userId } : { telegramId }

    const userDoc = await UsersModel.findOne(query).lean()
    if (!userDoc) {
      return NextResponse.json(
        { success: false, error: 'Пользователь не найден' },
        { status: 404 },
      )
    }

    const userTelegramId = normalizeTelegramId(userDoc?.telegramId)
    const targetUserIds = collectUserIdCandidates(userDoc)
    const memberships = await resolveMembershipsByUserIds({
      TeamsUsersModel,
      userIds: targetUserIds,
    })

    const teamIds = Array.from(
      new Set(
        memberships.map((doc) => toStringId(doc?.teamId)).filter(Boolean),
      ),
    )

    const teamsDocs = teamIds.length
      ? await TeamsModel.find({ _id: { $in: teamIds } })
          .select({
            _id: 1,
            name: 1,
            image: 1,
            location: 1,
            updatedAt: 1,
            gameStats: 1,
          })
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
        location: typeof team?.location === 'string' ? team.location : '',
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
        const role = normalizeTeamRoleForWrite(membership?.role)

        return {
          ...team,
          role,
          isCaptain: isCaptainRole(role),
        }
      })
      .filter(Boolean)

    const profile = normalizeUserProfile(userDoc)
    const role = ensureRole(userDoc?.role)
    const isAdmin = isUserAdmin({ role: session?.user?.role })
    const sessionUserIds = collectUserIdCandidates(session?.user)
    const isOwnProfile = targetUserIds.some((userId) =>
      sessionUserIds.includes(userId),
    )
    const canViewContacts =
      isAdmin ||
      isOwnProfile ||
      (sessionUserIds.length > 0 &&
        (await resolveMembershipsByUserIds({
          TeamsUsersModel,
          userIds: sessionUserIds,
        })).some((membership) =>
          teamIds.includes(toStringId(membership?.teamId)),
        ))

    const payload = {
      ...profile,
      id: toStringId(userDoc?._id),
      globalUserId: userDoc?.globalUserId ? String(userDoc.globalUserId) : null,
      telegramId: userTelegramId !== null ? String(userTelegramId) : '',
      role,
      canBeGameModerator: Boolean(userDoc?.canBeGameModerator),
      canBeGameAgent: Boolean(userDoc?.canBeGameAgent),
      createdAt: ensureDateISOString(userDoc?.createdAt),
      updatedAt: ensureDateISOString(userDoc?.updatedAt),
      teams,
      teamsCount: teams.length,
      gamesCount: Number.isFinite(Number(userDoc?.gameStats?.playedGamesCount))
        ? Number(userDoc.gameStats.playedGamesCount)
        : 0,
      rating:
        userDoc?.rating && typeof userDoc.rating === 'object'
          ? userDoc.rating
          : null,
    }

    if (!canViewContacts) {
      payload.phone = ''
    }

    return NextResponse.json({ success: true, data: payload }, { status: 200 })
  } catch (error) {
    console.error('Failed to load cabinet user details (app)', error)
    return NextResponse.json(
      { success: false, error: 'Не удалось загрузить пользователя' },
      { status: 500 },
    )
  }
}
