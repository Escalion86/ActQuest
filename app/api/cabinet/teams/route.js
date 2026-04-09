import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import fetchTeamsForCabinet from '@helpers/fetchTeamsForCabinet'
import { authOptions } from '@server/auth/authOptions'
import { LOCATIONS } from '@server/serverConstants'
import dbConnectGlobal from '@utils/dbConnectGlobal'
import logSiteEvent from '@helpers/logSiteEvent'
import { toStringId } from '@helpers/idAndDate'

const collectTeamIds = (searchParams) => {
  const rawIds = []
  const appendValue = (value) => {
    if (!value) {
      return
    }

    if (Array.isArray(value)) {
      value.forEach((item) => appendValue(item))
      return
    }

    if (typeof value === 'string') {
      value
        .split(',')
        .map((item) => item.trim())
        .filter(
          (item) => item.length > 0 && item !== 'undefined' && item !== 'null',
        )
        .forEach((item) => rawIds.push(item))
    }
  }

  appendValue(searchParams.getAll('teamIds'))
  appendValue(searchParams.get('teamIds'))
  appendValue(searchParams.getAll('teamId'))
  appendValue(searchParams.get('teamId'))

  return Array.from(new Set(rawIds))
}

const normalizeRole = (value) => {
  if (typeof value !== 'string') {
    return 'client'
  }
  const normalizedRaw = value.trim().toLowerCase()
  const normalized = normalizedRaw
  return ['client', 'moder', 'admin', 'dev'].includes(normalized)
    ? normalized
    : 'client'
}

const isElevatedRole = (role) => role === 'admin' || role === 'dev'
const resolveAllowedLocations = () =>
  Object.entries(LOCATIONS)
    .filter(([, value]) => !value?.hidden)
    .map(([key]) => key)
const normalizeLocation = (value) =>
  typeof value === 'string' ? value.trim().toLowerCase() : ''

export async function GET(request) {
  const requestUrl = new URL(request.url)
  const teamIds = collectTeamIds(requestUrl.searchParams)
  const location = requestUrl.searchParams.get('location')

  if (teamIds.length === 0) {
    return NextResponse.json(
      { success: false, error: 'Не переданы идентификаторы команд' },
      { status: 400 },
    )
  }

  try {
    const db = await dbConnectGlobal()

    if (!db) {
      throw new Error('Соединение с базой данных не установлено')
    }

    const teams = await fetchTeamsForCabinet({
      db,
      teamIds,
      location: typeof location === 'string' ? location : null,
    })

    return NextResponse.json(
      {
        success: true,
        data: teams,
        meta: { location: typeof location === 'string' ? location : null },
      },
      { status: 200 },
    )
  } catch (error) {
    console.error(
      'Failed to load cabinet teams via app router API pilot',
      error,
    )
    return NextResponse.json(
      { success: false, error: 'Не удалось загрузить команды' },
      { status: 500 },
    )
  }
}

export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: 'Необходима авторизация' },
      { status: 401 },
    )
  }

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
  const allowedLocations = resolveAllowedLocations()
  const sessionLocation = normalizeLocation(session.user?.location)
  const location = allowedLocations.includes(sessionLocation)
    ? sessionLocation
    : ''

  if (!name) {
    return NextResponse.json(
      { success: false, error: 'Введите название команды' },
      { status: 400 },
    )
  }
  if (!location) {
    return NextResponse.json(
      {
        success: false,
        error:
          'Не удалось определить город пользователя. Выберите город в кабинете и повторите попытку.',
      },
      { status: 400 },
    )
  }

  try {
    const db = await dbConnectGlobal()
    if (!db) {
      throw new Error('Соединение с базой данных не установлено')
    }

    const TeamsModel = db.model('Teams')
    const TeamsUsersModel = db.model('TeamsUsers')

    const actorRole = normalizeRole(session.user.role)
    const actorUserId = toStringId(
      session.user.globalUserId ?? session.user.userId ?? session.user._id,
    )
    const actorTelegramIdRaw = Number(session.user.telegramId)
    const actorTelegramId =
      Number.isFinite(actorTelegramIdRaw) && actorTelegramIdRaw !== 0
        ? actorTelegramIdRaw
        : null

    if (!actorUserId && actorTelegramId === null) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Чтобы создавать команды, требуется авторизованный пользователь',
        },
        { status: 403 },
      )
    }

    const createdTeam = await TeamsModel.create({
      name,
      name_lowered: name.toLowerCase(),
      description,
      image,
      open,
      location,
    })

    // Создатель всегда становится капитаном команды
    await TeamsUsersModel.create({
      teamId: toStringId(createdTeam?._id),
      userId: actorUserId,
      userTelegramId: actorTelegramId,
      role: 'capitan',
    })

    const createdTeamId = toStringId(createdTeam?._id)
    const createdTeamName =
      typeof createdTeam?.name === 'string' ? createdTeam.name : name
    const createdTeamLocation =
      typeof createdTeam?.location === 'string' && createdTeam.location.trim()
        ? createdTeam.location.trim().toLowerCase()
        : location

    await logSiteEvent({
      db,
      type: 'team_created',
      location: createdTeamLocation,
      message: `Создана команда «${createdTeamName}»`,
      actorUserId,
      actorTelegramId,
      teamId: createdTeamId,
      teamName: createdTeamName,
      metadata: {
        open: Boolean(createdTeam?.open ?? open),
      },
    })

    return NextResponse.json(
      {
        success: true,
        data: {
          id: createdTeamId,
          _id: createdTeamId,
          name: createdTeamName,
          description: createdTeam?.description ?? description,
          image: createdTeam?.image ?? image,
          open: Boolean(createdTeam?.open ?? open),
          location:
            typeof createdTeam?.location === 'string'
              ? createdTeam.location
              : location,
        },
      },
      { status: 201 },
    )
  } catch (error) {
    console.error('Failed to create team via cabinet API (app)', error)
    return NextResponse.json(
      { success: false, error: 'Не удалось создать команду' },
      { status: 500 },
    )
  }
}
