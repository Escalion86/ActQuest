import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import fetchTeamsForCabinet from '@helpers/fetchTeamsForCabinet'
import { authOptions } from '@server/auth/authOptions'
import dbConnectGlobal from '@utils/dbConnectGlobal'

const toStringId = (value) => {
  if (value === null || value === undefined) {
    return null
  }

  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'number') {
    return value.toString()
  }

  if (typeof value.toString === 'function') {
    const result = value.toString()
    return result === '[object Object]' ? null : result
  }

  return null
}

const normalizeGameTeamEntry = (doc) => {
  const id = toStringId(doc?._id ?? doc?.id)
  const teamId = toStringId(doc?.teamId)

  if (!id || !teamId) {
    return null
  }

  return { id, teamId }
}

const isObjectIdLike = (value) =>
  typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value.trim())

const findGameByAnyId = async (GamesModel, rawGameId, select) => {
  const normalized = toStringId(rawGameId)
  if (!normalized) {
    return null
  }

  if (isObjectIdLike(normalized)) {
    const byObjectId = await GamesModel.findById(normalized).select(select).lean()
    if (byObjectId?._id) {
      return byObjectId
    }
  }

  return GamesModel.findOne({ id: normalized }).select(select).lean()
}

const normalizeRole = (value) => {
  if (typeof value !== 'string') {
    return 'client'
  }
  const normalizedRaw = value.trim().toLowerCase()
  const normalized = normalizedRaw === 'moderator' ? 'moder' : normalizedRaw
  return ['client', 'moder', 'admin', 'dev'].includes(normalized)
    ? normalized
    : 'client'
}

const isElevatedRole = (role) => role === 'admin' || role === 'dev'

const resolveSessionIdentity = (session) => {
  const sessionUser = session?.user ?? {}
  const userId = toStringId(
    sessionUser.globalUserId ??
      sessionUser.userId ??
      sessionUser._id ??
      sessionUser.id ??
      null,
  )
  const telegramIdRaw = Number(sessionUser.telegramId)
  const telegramId = Number.isFinite(telegramIdRaw) ? telegramIdRaw : null

  return {
    userId,
    telegramId,
    role: normalizeRole(sessionUser.role),
  }
}

const resolveMembershipFilter = ({ userId, telegramId }) => {
  const orFilter = []
  if (userId) {
    orFilter.push({ userId })
  }
  if (Number.isFinite(telegramId)) {
    orFilter.push({ userTelegramId: telegramId })
  }
  return orFilter
}

const ensureGameAllowsRegistration = (game) => {
  const status = String(game?.status ?? '')
    .trim()
    .toLowerCase()
  if (status !== 'active') {
    return 'Запись на эту игру закрыта'
  }
  if (game?.registrationOpen === false) {
    return 'Запись на эту игру закрыта'
  }
  return null
}

export async function GET(request, { params }) {
  const resolvedParams = await params
  const { gameId } = resolvedParams ?? {}

  const normalizedGameId = toStringId(gameId)

  if (
    !normalizedGameId ||
    normalizedGameId === 'undefined' ||
    normalizedGameId === 'null'
  ) {
    return NextResponse.json(
      { success: false, error: 'Не передан идентификатор игры' },
      { status: 400 },
    )
  }

  try {
    const db = await dbConnectGlobal()

    if (!db) {
      throw new Error('Соединение с базой данных не установлено')
    }

    const GamesModel = db.model('Games')
    const game = await findGameByAnyId(
      GamesModel,
      normalizedGameId,
      { _id: 1, location: 1 },
    )

    if (!game) {
      return NextResponse.json(
        { success: false, error: 'Игра не найдена' },
        { status: 404 },
      )
    }

    const gameLocationRaw =
      typeof game.location === 'string'
        ? game.location.trim().toLowerCase()
        : null
    const gameLocation = gameLocationRaw || null

    const GamesTeamsModel = db.model('GamesTeams')
    const normalizedResolvedGameId = toStringId(game?._id)
    const gameTeamsDocs = await GamesTeamsModel.find({
      gameId: normalizedResolvedGameId,
    })
      .select({ _id: 1, teamId: 1 })
      .lean()

    const entries = Array.isArray(gameTeamsDocs)
      ? gameTeamsDocs.map((doc) => normalizeGameTeamEntry(doc)).filter(Boolean)
      : []

    const uniqueTeamIds = Array.from(new Set(entries.map((entry) => entry.teamId)))

    const teams = uniqueTeamIds.length
      ? await fetchTeamsForCabinet({
          db,
          teamIds: uniqueTeamIds,
          location: gameLocation,
        })
      : []

    const allTeams = await fetchTeamsForCabinet({
      db,
      location: gameLocation,
      limit: 500,
      offset: 0,
    })

    return NextResponse.json(
      {
        success: true,
        data: {
          entries,
          teams,
          allTeams: Array.isArray(allTeams) ? allTeams : [],
        },
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('Failed to load game teams for cabinet (app)', error)
    return NextResponse.json(
      { success: false, error: 'Не удалось загрузить команды игры' },
      { status: 500 },
    )
  }
}

export async function POST(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: 'Требуется авторизация' },
      { status: 401 },
    )
  }

  const resolvedParams = await params
  const gameId = toStringId(resolvedParams?.gameId)
  const payload = await request.json().catch(() => ({}))
  const teamId = toStringId(payload?.teamId)

  if (!gameId || !teamId) {
    return NextResponse.json(
      { success: false, error: 'Не передан идентификатор игры или команды' },
      { status: 400 },
    )
  }

  try {
    const db = await dbConnectGlobal()
    if (!db) {
      throw new Error('Соединение с базой данных не установлено')
    }

    const GamesModel = db.model('Games')
    const TeamsModel = db.model('Teams')
    const TeamsUsersModel = db.model('TeamsUsers')
    const GamesTeamsModel = db.model('GamesTeams')

    const game = await findGameByAnyId(
      GamesModel,
      gameId,
      { _id: 1, status: 1, registrationOpen: 1 },
    )
    if (!game?._id) {
      return NextResponse.json(
        { success: false, error: 'Игра не найдена' },
        { status: 404 },
      )
    }
    const normalizedResolvedGameId = toStringId(game._id)

    const registrationError = ensureGameAllowsRegistration(game)
    if (registrationError) {
      return NextResponse.json(
        { success: false, error: registrationError },
        { status: 403 },
      )
    }

    const team = await TeamsModel.findById(teamId).select({ _id: 1 }).lean()
    if (!team?._id) {
      return NextResponse.json(
        { success: false, error: 'Команда не найдена' },
        { status: 404 },
      )
    }

    const identity = resolveSessionIdentity(session)
    const membershipOr = resolveMembershipFilter(identity)
    if (!isElevatedRole(identity.role)) {
      if (membershipOr.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Недостаточно прав для регистрации команды' },
          { status: 403 },
        )
      }

      const captainMembership = await TeamsUsersModel.findOne({
        teamId,
        role: 'capitan',
        $or: membershipOr,
      })
        .select({ _id: 1 })
        .lean()

      if (!captainMembership?._id) {
        return NextResponse.json(
          { success: false, error: 'Регистрация доступна только капитану команды' },
          { status: 403 },
        )
      }
    }

    const existing = await GamesTeamsModel.findOne({
      gameId: normalizedResolvedGameId,
      teamId,
    })
      .select({ _id: 1 })
      .lean()
    if (existing?._id) {
      return NextResponse.json(
        { success: false, error: 'Команда уже зарегистрирована на эту игру' },
        { status: 409 },
      )
    }

    const created = await GamesTeamsModel.create({
      gameId: normalizedResolvedGameId,
      teamId,
    })
    return NextResponse.json(
      {
        success: true,
        data: {
          id: toStringId(created?._id),
          gameId: normalizedResolvedGameId,
          teamId,
        },
      },
      { status: 201 },
    )
  } catch (error) {
    console.error('Failed to register team for game (app)', error)
    return NextResponse.json(
      { success: false, error: 'Не удалось зарегистрироваться на игру' },
      { status: 500 },
    )
  }
}

export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: 'Требуется авторизация' },
      { status: 401 },
    )
  }

  const resolvedParams = await params
  const gameId = toStringId(resolvedParams?.gameId)
  const payload = await request.json().catch(() => ({}))
  const teamIdsRaw = Array.isArray(payload?.teamIds) ? payload.teamIds : []
  const teamIds = Array.from(
    new Set(teamIdsRaw.map((value) => toStringId(value)).filter(Boolean)),
  )

  if (!gameId || teamIds.length === 0) {
    return NextResponse.json(
      { success: false, error: 'Не передан идентификатор игры или команд' },
      { status: 400 },
    )
  }

  try {
    const db = await dbConnectGlobal()
    if (!db) {
      throw new Error('Соединение с базой данных не установлено')
    }

    const GamesModel = db.model('Games')
    const TeamsUsersModel = db.model('TeamsUsers')
    const GamesTeamsModel = db.model('GamesTeams')

    const game = await findGameByAnyId(GamesModel, gameId, { _id: 1 })
    if (!game?._id) {
      return NextResponse.json(
        { success: false, error: 'Игра не найдена' },
        { status: 404 },
      )
    }
    const normalizedResolvedGameId = toStringId(game._id)

    const identity = resolveSessionIdentity(session)
    if (!isElevatedRole(identity.role)) {
      const membershipOr = resolveMembershipFilter(identity)
      if (membershipOr.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Недостаточно прав для отмены регистрации' },
          { status: 403 },
        )
      }

      const captainMemberships = await TeamsUsersModel.find({
        teamId: { $in: teamIds },
        role: 'capitan',
        $or: membershipOr,
      })
        .select({ teamId: 1 })
        .lean()

      const allowedTeamIds = new Set(
        captainMemberships
          .map((item) => toStringId(item?.teamId))
          .filter(Boolean),
      )
      const hasForbiddenTeam = teamIds.some((teamIdValue) => !allowedTeamIds.has(teamIdValue))
      if (hasForbiddenTeam) {
        return NextResponse.json(
          { success: false, error: 'Отмена регистрации доступна только капитану команды' },
          { status: 403 },
        )
      }
    }

    const deleteResult = await GamesTeamsModel.deleteMany({
      gameId: normalizedResolvedGameId,
      teamId: { $in: teamIds },
    })

    return NextResponse.json(
      {
        success: true,
        data: {
          deletedCount: Number(deleteResult?.deletedCount || 0),
          gameId: normalizedResolvedGameId,
          teamIds,
        },
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('Failed to cancel team registration for game (app)', error)
    return NextResponse.json(
      { success: false, error: 'Не удалось отменить регистрацию команды' },
      { status: 500 },
    )
  }
}
