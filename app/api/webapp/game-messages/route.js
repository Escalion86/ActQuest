import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import dbConnectGlobal from '@utils/dbConnectGlobal'
import { toStringId } from '@helpers/idAndDate'
import {
  fetchGameTeamMessages,
  getSessionUserId,
  getTeamMembershipForUser,
  markAdminMessagesReadByTeam,
  normalizeMessageBody,
} from '@server/gameTeamMessages'

const getSessionTelegramId = (session) => {
  const telegramId = Number(session?.user?.telegramId)
  return Number.isFinite(telegramId) ? telegramId : null
}

const normalizeRole = (value) =>
  typeof value === 'string' ? value.trim().toLowerCase() : ''

export async function GET(request) {
  const session = await getServerSession(authOptions)
  const userId = getSessionUserId(session?.user)
  const telegramId = getSessionTelegramId(session)
  if (!userId && telegramId === null) {
    return NextResponse.json(
      { success: false, error: 'Требуется авторизация' },
      { status: 401 },
    )
  }

  const gameId = toStringId(request.nextUrl.searchParams.get('gameId'))
  const teamId = toStringId(request.nextUrl.searchParams.get('teamId'))
  if (!gameId || !teamId) {
    return NextResponse.json(
      { success: false, error: 'Не переданы игра или команда' },
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

    const gameTeam = await db
      .model('GamesTeams')
      .findOne({ gameId, teamId })
      .select({ _id: 1 })
      .lean()
    if (!gameTeam) {
      return NextResponse.json(
        { success: false, error: 'Команда не участвует в игре' },
        { status: 404 },
      )
    }

    const membership = await getTeamMembershipForUser({
      db,
      teamId,
      userId,
      telegramId,
    })
    if (!membership) {
      return NextResponse.json(
        { success: false, error: 'Вы не состоите в этой команде' },
        { status: 403 },
      )
    }

    const messages = await fetchGameTeamMessages({ db, gameId, teamId })

    await markAdminMessagesReadByTeam({ db, gameId, teamId })

    return NextResponse.json({
      success: true,
      data: {
        messages,
        canSendToAdmin: normalizeRole(membership.role) === 'captain',
      },
    })
  } catch (error) {
    console.error('Failed to fetch web game messages', error)
    return NextResponse.json(
      { success: false, error: 'Не удалось загрузить сообщения' },
      { status: 500 },
    )
  }
}

export async function POST(request) {
  const session = await getServerSession(authOptions)
  const userId = getSessionUserId(session?.user)
  const telegramId = getSessionTelegramId(session)
  if (!userId && telegramId === null) {
    return NextResponse.json(
      { success: false, error: 'Требуется авторизация' },
      { status: 401 },
    )
  }

  const body = (await request.json().catch(() => ({}))) || {}
  const gameId = toStringId(body?.gameId)
  const teamId = toStringId(body?.teamId)
  const messageBody = normalizeMessageBody(body?.body)

  if (!gameId || !teamId) {
    return NextResponse.json(
      { success: false, error: 'Не переданы игра или команда' },
      { status: 400 },
    )
  }

  if (!messageBody) {
    return NextResponse.json(
      { success: false, error: 'Введите сообщение' },
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

    const gameTeam = await db
      .model('GamesTeams')
      .findOne({ gameId, teamId })
      .select({ _id: 1 })
      .lean()
    if (!gameTeam) {
      return NextResponse.json(
        { success: false, error: 'Команда не участвует в игре' },
        { status: 404 },
      )
    }

    const membership = await getTeamMembershipForUser({
      db,
      teamId,
      userId,
      telegramId,
    })
    if (!membership) {
      return NextResponse.json(
        { success: false, error: 'Вы не состоите в этой команде' },
        { status: 403 },
      )
    }

    if (normalizeRole(membership.role) !== 'captain') {
      return NextResponse.json(
        { success: false, error: 'Писать администратору может только капитан' },
        { status: 403 },
      )
    }

    const created = await db.model('GameTeamMessages').create({
      gameId,
      teamId,
      scope: 'team',
      direction: 'team_to_admin',
      body: messageBody,
      createdByUserId: userId,
      createdByRole: 'captain',
      createdByName:
        session?.user?.name || session?.user?.username || 'Капитан команды',
    })

    return NextResponse.json({
      success: true,
      data: {
        message: {
          id: String(created._id),
          gameId: created.gameId,
          teamId: created.teamId,
          scope: created.scope,
          direction: created.direction,
          body: created.body,
          createdByUserId: created.createdByUserId,
          createdByRole: created.createdByRole,
          createdByName: created.createdByName,
          pushRequested: false,
          pushUsersMatched: 0,
          pushNotificationsCreated: 0,
          pushDelivered: 0,
          pushError: null,
          createdAt: created.createdAt?.toISOString?.() || null,
          updatedAt: created.updatedAt?.toISOString?.() || null,
        },
      },
    })
  } catch (error) {
    console.error('Failed to create web game message', error)
    return NextResponse.json(
      { success: false, error: 'Не удалось отправить сообщение' },
      { status: 500 },
    )
  }
}
