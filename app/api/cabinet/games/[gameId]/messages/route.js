import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import dbConnectGlobal from '@utils/dbConnectGlobal'
import { broadcastNotificationToUsers } from '@server/pwaNotifications'
import { toStringId } from '@helpers/idAndDate'
import {
  fetchGameTeamMessages,
  getRegisteredTeamIds,
  getSessionUserId,
  getUsersForTeamIds,
  isGameManager,
  markTeamMessagesReadByAdmin,
  normalizeMessageBody,
  normalizeRole,
} from '@server/gameTeamMessages'

const getGameForMessages = (db, gameId) =>
  db
    .model('Games')
    .findById(gameId)
    .select({
      _id: 1,
      name: 1,
      location: 1,
      creatorUserId: 1,
      creatorTelegramId: 1,
      moderators: 1,
    })
    .lean()

const getTeamName = async ({ db, teamId }) => {
  if (!teamId) return ''

  try {
    const team = await db
      .model('Teams')
      .findById(teamId)
      .select({ name: 1 })
      .lean()
    return typeof team?.name === 'string' ? team.name.trim() : ''
  } catch {
    return ''
  }
}

export async function GET(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: 'Требуется авторизация' },
      { status: 401 },
    )
  }

  const resolvedParams = await params
  const gameId = toStringId(resolvedParams?.gameId)
  const teamId = toStringId(request.nextUrl.searchParams.get('teamId'))
  if (!gameId) {
    return NextResponse.json(
      { success: false, error: 'Не передан идентификатор игры' },
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

    const game = await getGameForMessages(db, gameId)
    if (!game) {
      return NextResponse.json(
        { success: false, error: 'Игра не найдена' },
        { status: 404 },
      )
    }

    if (!isGameManager({ sessionUser: session.user, game })) {
      return NextResponse.json(
        { success: false, error: 'Недостаточно прав' },
        { status: 403 },
      )
    }

    if (teamId) {
      await markTeamMessagesReadByAdmin({ db, gameId, teamId })
    }

    const messages = await fetchGameTeamMessages({ db, gameId, teamId })
    return NextResponse.json({ success: true, data: { messages } })
  } catch (error) {
    console.error('Failed to fetch game team messages', error)
    return NextResponse.json(
      { success: false, error: 'Не удалось загрузить сообщения' },
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
  if (!gameId) {
    return NextResponse.json(
      { success: false, error: 'Не передан идентификатор игры' },
      { status: 400 },
    )
  }

  const body = (await request.json().catch(() => ({}))) || {}
  const scope = body?.scope === 'game' ? 'game' : 'team'
  const teamId = scope === 'team' ? toStringId(body?.teamId) : ''
  const messageBody = normalizeMessageBody(body?.body)
  const sendPush = body?.sendPush === true

  if (scope === 'team' && !teamId) {
    return NextResponse.json(
      { success: false, error: 'Не передана команда' },
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

    const game = await getGameForMessages(db, gameId)
    if (!game) {
      return NextResponse.json(
        { success: false, error: 'Игра не найдена' },
        { status: 404 },
      )
    }

    if (!isGameManager({ sessionUser: session.user, game })) {
      return NextResponse.json(
        { success: false, error: 'Недостаточно прав' },
        { status: 403 },
      )
    }

    if (scope === 'team') {
      const registeredTeamIds = await getRegisteredTeamIds({ db, gameId })
      if (!registeredTeamIds.includes(teamId)) {
        return NextResponse.json(
          { success: false, error: 'Команда не зарегистрирована на игру' },
          { status: 404 },
        )
      }
    }

    const GameTeamMessages = db.model('GameTeamMessages')
    const created = await GameTeamMessages.create({
      gameId,
      teamId: scope === 'team' ? teamId : null,
      scope,
      direction: 'admin_to_team',
      body: messageBody,
      createdByUserId: getSessionUserId(session.user),
      createdByRole:
        normalizeRole(session.user.role) === 'dev' ? 'dev' : 'admin',
      createdByName: session.user.name || session.user.username || 'Организатор',
      pushRequested: sendPush,
    })

    let pushResult = null
    let pushError = null
    if (sendPush) {
      try {
        const targetTeamIds =
          scope === 'game'
            ? await getRegisteredTeamIds({ db, gameId })
            : [teamId]
        const users = await getUsersForTeamIds({ db, teamIds: targetTeamIds })
        const gameName =
          typeof game?.name === 'string' && game.name.trim()
            ? game.name.trim()
            : 'Без названия'
        const teamName =
          scope === 'team' ? await getTeamName({ db, teamId }) : ''

        pushResult = await broadcastNotificationToUsers({
          db,
          users,
          notification: {
            title:
              scope === 'game'
                ? `Сообщение по игре «${gameName}»`
                : `Сообщение команде${teamName ? ` «${teamName}»` : ''}`,
            body: messageBody,
            tag: `game-message-${gameId}-${scope}-${Date.now()}`,
            location: typeof game.location === 'string' ? game.location : 'global',
            data: {
              type: 'game_admin_message',
              gameId,
              ...(scope === 'team' ? { teamId } : {}),
              location: typeof game.location === 'string' ? game.location : 'global',
              url: teamId
                ? `/game/${encodeURIComponent(gameId)}/process/${encodeURIComponent(teamId)}`
                : '/cabinet/games-upcoming',
            },
            url: teamId
              ? `/game/${encodeURIComponent(gameId)}/process/${encodeURIComponent(teamId)}`
              : '/cabinet/games-upcoming',
          },
        })
      } catch (error) {
        pushError = error?.message || 'Не удалось отправить push'
      }

      created.pushUsersMatched = Number(pushResult?.created || 0)
      created.pushNotificationsCreated = Number(pushResult?.created || 0)
      created.pushDelivered = Number(pushResult?.delivered || 0)
      created.pushError = pushError
      await created.save()
    }

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
          pushRequested: Boolean(created.pushRequested),
          pushUsersMatched: Number(created.pushUsersMatched || 0),
          pushNotificationsCreated: Number(created.pushNotificationsCreated || 0),
          pushDelivered: Number(created.pushDelivered || 0),
          pushError: created.pushError || null,
          createdAt: created.createdAt?.toISOString?.() || null,
          updatedAt: created.updatedAt?.toISOString?.() || null,
        },
      },
    })
  } catch (error) {
    console.error('Failed to create game team message', error)
    return NextResponse.json(
      { success: false, error: 'Не удалось отправить сообщение' },
      { status: 500 },
    )
  }
}
