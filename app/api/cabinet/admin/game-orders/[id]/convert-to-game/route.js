import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import isUserAdmin from '@helpers/isUserAdmin'
import normalizeGameOrderForCabinet from '@helpers/normalizeGameOrderForCabinet'
import dbConnectGlobal from '@utils/dbConnectGlobal'

const normalizeString = (value, maxLength = 300) =>
  typeof value === 'string' ? value.trim().slice(0, maxLength) : ''

const resolveSessionUserId = (sessionUser) => {
  const value =
    sessionUser?.globalUserId ??
    sessionUser?.userId ??
    sessionUser?._id ??
    sessionUser?.id ??
    null

  return value && typeof value.toString === 'function' ? value.toString() : null
}

const normalizeTelegramId = (value) => {
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null
}

export async function POST(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user || !isUserAdmin({ role: session.user.role })) {
    return NextResponse.json(
      { success: false, error: 'Недостаточно прав' },
      { status: 403 },
    )
  }

  const resolvedParams = await params
  const id = typeof resolvedParams?.id === 'string' ? resolvedParams.id : ''
  const rawBody = await request.json().catch(() => ({}))
  const payload =
    rawBody && typeof rawBody === 'object' && rawBody.data
      ? rawBody.data
      : rawBody

  try {
    const db = await dbConnectGlobal()
    if (!db) {
      throw new Error('Соединение с базой данных не установлено')
    }

    const GameOrders = db.model('GameOrders')
    const Games = db.model('Games')
    const order = await GameOrders.findById(id)
    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Заявка не найдена' },
        { status: 404 },
      )
    }

    if (order.convertedGameId) {
      return NextResponse.json(
        { success: false, error: 'По этой заявке уже создана игра' },
        { status: 409 },
      )
    }

    const requestedName = normalizeString(payload?.name)
    const fallbackName = order.companyName
      ? `Корпоративная игра: ${order.companyName}`
      : `Заказная игра: ${order.contactName || 'клиент'}`
    const dateStart = order.preferredDate ? new Date(order.preferredDate) : null
    if (dateStart && order.preferredTime) {
      const [hours, minutes] = String(order.preferredTime).split(':')
      dateStart.setHours(Number(hours) || 0, Number(minutes) || 0, 0, 0)
    }

    const contactParts = [order.phone, order.telegram, order.email]
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean)

    const createdGame = await Games.create({
      name: requestedName || fallbackName,
      description: order.comment || '',
      dateStart,
      location: order.location,
      type: order.gameType === 'photo' ? 'photo' : 'classic',
      hidden: true,
      isPrivate: true,
      orderType: 'corporate',
      sourceOrderId: String(order._id),
      clientName: order.companyName || order.contactName || '',
      clientContact: contactParts.join(', '),
      expectedParticipantsCount: order.participantsCount || null,
      creatorUserId: resolveSessionUserId(session.user),
      creatorTelegramId: normalizeTelegramId(session.user.telegramId),
      status: 'active',
      isRated: false,
    })

    order.status = 'converted'
    order.convertedGameId = String(createdGame._id)
    await order.save()

    return NextResponse.json(
      {
        success: true,
        data: {
          order: normalizeGameOrderForCabinet(order.toObject()),
          game: {
            id: String(createdGame._id),
            name: createdGame.name,
            location: createdGame.location,
          },
        },
      },
      { status: 201 },
    )
  } catch (error) {
    console.error('Failed to convert game order to game (app)', error)
    return NextResponse.json(
      { success: false, error: 'Не удалось создать игру из заявки' },
      { status: 500 },
    )
  }
}
