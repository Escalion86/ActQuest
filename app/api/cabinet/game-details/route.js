import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import {
  canViewCabinetGameRestrictedInfo,
  sanitizeCabinetGameForViewer,
} from '@helpers/cabinetGameVisibility'
import normalizeGameForCabinet from '@helpers/normalizeGameForCabinet'
import { toStringId } from '@helpers/idAndDate'
import dbConnectGlobal from '@utils/dbConnectGlobal'
import { canAccessGameAsModerator } from '@helpers/gameAssignmentAccess'

const normalizeRole = (value) => {
  if (typeof value !== 'string') {
    return null
  }

  const normalizedRaw = value.trim().toLowerCase()
  const normalized = normalizedRaw
  return ['client', 'admin', 'dev', 'ban'].includes(normalized)
    ? normalized
    : null
}

const toObjectIdCompatible = (value) => {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const isObjectIdLike = (value) =>
  typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value.trim())

const normalizeTelegramId = (value) => {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null
  }

  return numeric
}

export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: 'Требуется авторизация' },
      { status: 401 },
    )
  }

  const requestUrl = new URL(request.url)
  const gameId = toObjectIdCompatible(requestUrl.searchParams.get('gameId'))
  if (!gameId) {
    return NextResponse.json(
      { success: false, error: 'Не передан gameId' },
      { status: 400 },
    )
  }

  try {
    const db = await dbConnectGlobal()
    if (!db) {
      throw new Error('Не удалось подключиться к базе данных')
    }

    const sessionRole = normalizeRole(session?.user?.role) ?? 'client'
    const previewRole = normalizeRole(
      requestUrl.searchParams.get('rolePreview'),
    )
    const userRole =
      sessionRole === 'dev' && previewRole && previewRole !== 'dev'
        ? previewRole
        : sessionRole

    const currentUserId =
      session?.user?.globalUserId ??
      session?.user?.userId ??
      session?.user?._id ??
      session?.user?.id ??
      null
    const currentUserIdString = toStringId(currentUserId)
    const rawTelegramId = session?.user?.telegramId
    const creatorTelegramId = normalizeTelegramId(rawTelegramId)

    const hasLocationQueryParam = requestUrl.searchParams.has('location')
    const locationFromQuery = hasLocationQueryParam
      ? requestUrl.searchParams.get('location')
      : null
    const locationFromSession =
      typeof session?.user?.location === 'string' ? session.user.location : null
    const locationBase = hasLocationQueryParam
      ? locationFromQuery
      : locationFromSession
    const location = (locationBase || '').trim().toLowerCase()
    const normalizedLocation = location === 'all' ? null : location || null

    const canLoadAllGames = userRole === 'admin' || userRole === 'dev'
    const canLoadOwnGames =
      Boolean(currentUserIdString) || creatorTelegramId !== null

    const query = { _id: gameId }

    if (!canLoadAllGames) {
      if (canLoadOwnGames) {
        query.$or = [
          ...(currentUserIdString ? [{ creatorUserId: currentUserIdString }] : []),
          ...(currentUserIdString ? [{ moderators: currentUserIdString }] : []),
          ...(creatorTelegramId !== null
            ? [{ creatorTelegramId }]
            : []),
        ]
      } else {
        query.hidden = { $ne: true }
      }
    }

    if (normalizedLocation) {
      query.location = normalizedLocation
    }

    const GamesModel = db.model('Games')
    const GamesTeamsModel = db.model('GamesTeams')
    const TeamsUsersModel = db.model('TeamsUsers')
    const UsersModel = db.model('Users')

    const gameDoc = await GamesModel.findOne(query)
      .select({
        _id: 1,
        name: 1,
        status: 1,
        dateStart: 1,
        dateStartFact: 1,
        dateEndFact: 1,
        type: 1,
        description: 1,
        descriptionRich: 1,
        descriptionMedia: 1,
        prequel: 1,
        image: 1,
        startingPlace: 1,
        finishingPlace: 1,
        showFinishingPlace: 1,
        taskDuration: 1,
        cluesDuration: 1,
        clueEarlyAccessMode: 1,
        clueEarlyPenalty: 1,
        allowCaptainForceClue: 1,
        allowCaptainFailTask: 1,
        allowCaptainFinishBreak: 1,
        breakDuration: 1,
        taskFailurePenalty: 1,
        manyCodesPenalty: 1,
        individualStart: 1,
        isRated: 1,
        hidden: 1,
        showCreator: 1,
        showTasks: 1,
        hideResult: 1,
        prices: 1,
        finances: 1,
        tasks: 1,
        updatedAt: 1,
        createdAt: 1,
        creatorUserId: 1,
        creatorTelegramId: 1,
        moderators: 1,
        agents: 1,
        agentNotifications: 1,
        location: 1,
        seasonId: 1,
        seasonName: 1,
        'result.computed': 1,
        'result.teamsPlaces': 1,
      })
      .populate({
        path: 'moderators',
        select: { _id: 1, name: 1, username: 1, telegramId: 1 },
      })
      .lean()

    if (!gameDoc) {
      return NextResponse.json(
        { success: false, error: 'Игра не найдена' },
        { status: 404 },
      )
    }

    const gameIdString = toStringId(gameDoc?._id)

    const gameTeams = gameIdString
      ? await GamesTeamsModel.find({ gameId: gameIdString })
          .select({ gameId: 1, teamId: 1 })
          .lean()
      : []

    const teamsCount = Array.isArray(gameTeams) ? gameTeams.length : 0

    let userTeamPlace = null
    if (gameDoc?.result?.teamsPlaces && gameTeams.length > 0) {
      const currentUserIdString = toStringId(currentUserId)
      const hasUserId = Boolean(currentUserIdString)

      if (hasUserId) {
        const teamIds = Array.from(
          new Set(
            gameTeams.map((doc) => toStringId(doc?.teamId)).filter(Boolean),
          ),
        )

        const memberships =
          teamIds.length
            ? await TeamsUsersModel.find({
                teamId: { $in: teamIds },
                userId: currentUserIdString,
              })
                .select({ teamId: 1 })
                .lean()
            : []

        const userTeamIdsSet = new Set(
          memberships.map((doc) => toStringId(doc?.teamId)).filter(Boolean),
        )

        const places = teamIds
          .filter((teamId) => userTeamIdsSet.has(teamId))
          .map((teamId) => {
            const teamsPlaces = gameDoc?.result?.teamsPlaces
            const value =
              teamsPlaces && typeof teamsPlaces.get === 'function'
                ? teamsPlaces.get(teamId)
                : teamsPlaces?.[teamId]
            const numeric = Number(value)
            return Number.isFinite(numeric) ? numeric : null
          })
          .filter((value) => Number.isFinite(value))
          .map(Number)

        if (places.length > 0) {
          userTeamPlace = Math.min(...places)
        }
      }
    }

    const canSeeClosedStatus = userRole === 'admin' || userRole === 'dev'
    const normalizedStatus =
      gameDoc?.status === 'closed' && !canSeeClosedStatus
        ? 'finished'
        : gameDoc?.status

    const creatorUserId = toStringId(gameDoc?.creatorUserId)
    const creatorTelegramIdRaw = normalizeTelegramId(gameDoc?.creatorTelegramId)
    const creatorDoc = isObjectIdLike(creatorUserId)
      ? await UsersModel.findById(creatorUserId)
          .select({ _id: 1, name: 1, username: 1, phone: 1, telegramId: 1 })
          .lean()
      : creatorTelegramIdRaw !== null
        ? await UsersModel.findOne({ telegramId: creatorTelegramIdRaw })
            .select({ _id: 1, name: 1, username: 1, phone: 1, telegramId: 1 })
            .lean()
        : null

    const agentUserIds = Array.from(
      new Set(
        (Array.isArray(gameDoc?.agents) ? gameDoc.agents : [])
          .map((agent) => toStringId(agent?.userId))
          .filter(Boolean),
      ),
    )
    const agentUsers = agentUserIds.length
      ? await UsersModel.find({ _id: { $in: agentUserIds } })
          .select({ _id: 1, name: 1, username: 1, telegramId: 1 })
          .lean()
      : []
    const agentUsersById = new Map(
      agentUsers.map((user) => [toStringId(user?._id), user]),
    )
    const enrichedAgents = (Array.isArray(gameDoc?.agents)
      ? gameDoc.agents
      : []
    ).map((agent) => {
      const userId = toStringId(agent?.userId)
      const user = agentUsersById.get(userId)
      return {
        userId,
        active: agent?.active !== false,
        name: user?.name || '',
        username: user?.username || '',
        telegramId: user?.telegramId || '',
      }
    })

    const normalizedGame = normalizeGameForCabinet({
      ...sanitizeCabinetGameForViewer(gameDoc, {
        canViewRestrictedGameInfo: canViewCabinetGameRestrictedInfo({
          userRole,
          currentUserId: currentUserIdString,
          gameCreatorUserId: creatorUserId,
          isGameModerator: canAccessGameAsModerator({
            userRole,
            currentUserId: currentUserIdString,
            game: gameDoc,
          }),
          allowCreatorFallback:
            canLoadOwnGames && !currentUserIdString && creatorTelegramId !== null,
        }),
      }),
      status: normalizedStatus,
      teamsCount,
      userTeamPlace,
      creator: creatorDoc,
      agents: enrichedAgents,
    })

    return NextResponse.json(
      { success: true, data: normalizedGame },
      { status: 200 },
    )
  } catch (error) {
    console.error('Failed to load cabinet game details (app)', error)
    return NextResponse.json(
      { success: false, error: 'Не удалось загрузить данные игры' },
      { status: 500 },
    )
  }
}
