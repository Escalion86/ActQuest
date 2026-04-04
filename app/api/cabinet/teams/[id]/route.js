import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import dbConnectGlobal from '@utils/dbConnectGlobal'

const normalizeStringId = (value) => {
  if (value === null || value === undefined) {
    return ''
  }

  if (typeof value === 'string') {
    return value.trim()
  }

  if (typeof value?.toString === 'function') {
    const nextValue = value.toString()
    return nextValue === '[object Object]' ? '' : nextValue.trim()
  }

  return ''
}

const normalizeTelegramId = (value) => {
  if (value === null || value === undefined) {
    return null
  }

  const asNumber = Number(value)
  return Number.isFinite(asNumber) ? asNumber : null
}

const isElevatedRole = (role) => role === 'admin' || role === 'dev'

export async function GET(request, { params }) {
  const resolvedParams = await params
  const teamId = normalizeStringId(resolvedParams?.id)
  if (!teamId) {
    return NextResponse.json(
      { success: false, error: 'Не указан идентификатор команды' },
      { status: 400 },
    )
  }

  try {
    const db = await dbConnectGlobal()
    if (!db) {
      return NextResponse.json(
        { success: false, error: 'База данных недоступна' },
        { status: 503 },
      )
    }

    const team = await db
      .model('Teams')
      .findById(teamId)
      .select({
        _id: 1,
        name: 1,
        name_lowered: 1,
        description: 1,
        image: 1,
        open: 1,
        updatedAt: 1,
      })
      .lean()

    if (!team?._id) {
      return NextResponse.json(
        { success: false, error: 'Команда не найдена' },
        { status: 404 },
      )
    }

    return NextResponse.json({ success: true, data: team }, { status: 200 })
  } catch (error) {
    console.error('Failed to load team from cabinet (app)', error)
    return NextResponse.json(
      { success: false, error: 'Не удалось загрузить команду' },
      { status: 500 },
    )
  }
}

export async function PUT(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: 'Необходима авторизация' },
      { status: 401 },
    )
  }

  const resolvedParams = await params
  const teamId = normalizeStringId(resolvedParams?.id)
  if (!teamId) {
    return NextResponse.json(
      { success: false, error: 'Не указан идентификатор команды' },
      { status: 400 },
    )
  }

  const userId = normalizeStringId(
    session.user.globalUserId ?? session.user.userId ?? session.user._id,
  )
  const userTelegramId = normalizeTelegramId(session.user.telegramId)
  const userRole =
    typeof session.user.role === 'string'
      ? session.user.role.trim().toLowerCase()
      : ''

  const body = await request.json().catch(() => ({}))
  const payload = body?.data && typeof body.data === 'object' ? body.data : body
  const name =
    typeof payload?.name === 'string' ? payload.name.trim().slice(0, 120) : ''
  const description =
    typeof payload?.description === 'string'
      ? payload.description.trim().slice(0, 2000)
      : ''
  const image = typeof payload?.image === 'string' ? payload.image : null
  const open = typeof payload?.open === 'boolean' ? payload.open : true

  if (!name) {
    return NextResponse.json(
      { success: false, error: 'Введите название команды' },
      { status: 400 },
    )
  }

  try {
    const db = await dbConnectGlobal()
    if (!db) {
      return NextResponse.json(
        { success: false, error: 'База данных недоступна' },
        { status: 503 },
      )
    }

    const TeamsModel = db.model('Teams')
    const TeamsUsersModel = db.model('TeamsUsers')

    const team = await TeamsModel.findById(teamId).select({ _id: 1 }).lean()
    if (!team?._id) {
      return NextResponse.json(
        { success: false, error: 'Команда не найдена' },
        { status: 404 },
      )
    }

    if (!isElevatedRole(userRole)) {
      const membershipOr = []
      if (userId) {
        membershipOr.push({ userId })
      }
      if (userTelegramId !== null) {
        membershipOr.push({ userTelegramId })
      }
      if (membershipOr.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Недостаточно прав для изменения команды' },
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
          { success: false, error: 'Изменять команду может только капитан' },
          { status: 403 },
        )
      }
    }

    const updatedTeam = await TeamsModel.findByIdAndUpdate(
      teamId,
      {
        $set: {
          name,
          name_lowered: name.toLowerCase(),
          description,
          image,
          open,
        },
      },
      { new: true },
    )
      .select({
        _id: 1,
        name: 1,
        name_lowered: 1,
        description: 1,
        image: 1,
        open: 1,
        updatedAt: 1,
      })
      .lean()

    return NextResponse.json(
      { success: true, data: updatedTeam },
      { status: 200 },
    )
  } catch (error) {
    console.error('Failed to update team from cabinet (app)', error)
    return NextResponse.json(
      { success: false, error: 'Не удалось сохранить команду' },
      { status: 500 },
    )
  }
}

export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: 'Необходима авторизация' },
      { status: 401 },
    )
  }

  const resolvedParams = await params
  const teamId = normalizeStringId(resolvedParams?.id)
  if (!teamId) {
    return NextResponse.json(
      { success: false, error: 'Не указан идентификатор команды' },
      { status: 400 },
    )
  }

  const userId = normalizeStringId(
    session.user.globalUserId ?? session.user.userId ?? session.user._id,
  )
  const userTelegramId = normalizeTelegramId(session.user.telegramId)
  const userRole =
    typeof session.user.role === 'string'
      ? session.user.role.trim().toLowerCase()
      : ''

  try {
    const db = await dbConnectGlobal()
    if (!db) {
      return NextResponse.json(
        { success: false, error: 'База данных недоступна' },
        { status: 503 },
      )
    }

    const TeamsModel = db.model('Teams')
    const TeamsUsersModel = db.model('TeamsUsers')
    const GamesTeamsModel = db.model('GamesTeams')
    const GamesModel = db.model('Games')

    const team = await TeamsModel.findById(teamId).select({ _id: 1, name: 1 }).lean()
    if (!team?._id) {
      return NextResponse.json(
        { success: false, error: 'Команда не найдена' },
        { status: 404 },
      )
    }

    if (!isElevatedRole(userRole)) {
      const membershipOr = []
      if (userId) {
        membershipOr.push({ userId })
      }
      if (userTelegramId !== null) {
        membershipOr.push({ userTelegramId })
      }

      if (membershipOr.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: 'Недостаточно прав для удаления команды',
          },
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
          {
            success: false,
            error: 'Удалять команду может только капитан',
          },
          { status: 403 },
        )
      }
    }

    const gameRegistrations = await GamesTeamsModel.find({ teamId })
      .select({ gameId: 1 })
      .lean()
    const gameIds = Array.from(
      new Set(
        gameRegistrations
          .map((entry) => normalizeStringId(entry?.gameId))
          .filter(Boolean),
      ),
    )

    if (gameIds.length > 0) {
      const now = new Date()
      const upcomingGames = await GamesModel.find({
        _id: { $in: gameIds },
        status: { $nin: ['finished', 'closed', 'canceled'] },
        $or: [
          { dateStart: { $gte: now } },
          { dateStart: null, status: { $in: ['active', 'started'] } },
        ],
      })
        .select({ _id: 1, name: 1 })
        .lean()

      if (upcomingGames.length > 0) {
        const upcomingGamesNames = upcomingGames
          .slice(0, 3)
          .map((game) =>
            `«${typeof game?.name === 'string' && game.name.trim() ? game.name.trim() : 'Без названия'}»`,
          )
          .join(', ')
        const suffix = upcomingGames.length > 3 ? ` и еще ${upcomingGames.length - 3}` : ''

        return NextResponse.json(
          {
            success: false,
            error: `Нельзя удалить команду: она зарегистрирована на предстоящие игры (${upcomingGamesNames}${suffix}). Сначала отмените регистрацию.`,
          },
          { status: 409 },
        )
      }
    }

    const [teamDeleteResult, teamUsersDeleteResult, gamesTeamsDeleteResult] =
      await Promise.all([
        TeamsModel.deleteOne({ _id: teamId }),
        TeamsUsersModel.deleteMany({ teamId }),
        GamesTeamsModel.deleteMany({ teamId }),
      ])

    if (!teamDeleteResult?.deletedCount) {
      return NextResponse.json(
        {
          success: false,
          error: 'Не удалось удалить команду',
        },
        { status: 400 },
      )
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          teamId,
          teamName: typeof team.name === 'string' ? team.name : '',
          removedMembersCount: Number(teamUsersDeleteResult?.deletedCount) || 0,
          removedGameRegistrationsCount:
            Number(gamesTeamsDeleteResult?.deletedCount) || 0,
        },
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('Failed to delete team from cabinet (app)', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Не удалось удалить команду. Попробуйте позже.',
      },
      { status: 500 },
    )
  }
}
