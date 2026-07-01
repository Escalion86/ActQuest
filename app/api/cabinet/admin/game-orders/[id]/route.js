import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import isUserAdmin from '@helpers/isUserAdmin'
import normalizeGameOrderForCabinet from '@helpers/normalizeGameOrderForCabinet'
import dbConnectGlobal from '@utils/dbConnectGlobal'

const ORDER_STATUSES = ['new', 'contacted', 'confirmed', 'converted', 'canceled']

const normalizeString = (value, maxLength = 2000) =>
  typeof value === 'string' ? value.trim().slice(0, maxLength) : ''

export async function PATCH(request, { params }) {
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

  const updates = {}
  if (Object.prototype.hasOwnProperty.call(payload, 'status')) {
    const status = normalizeString(payload.status, 50).toLowerCase()
    if (!ORDER_STATUSES.includes(status)) {
      return NextResponse.json(
        { success: false, error: 'Некорректный статус заявки' },
        { status: 400 },
      )
    }
    updates.status = status
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'managerComment')) {
    updates.managerComment = normalizeString(payload.managerComment)
  }

  if (!id || Object.keys(updates).length === 0) {
    return NextResponse.json(
      { success: false, error: 'Нет данных для обновления' },
      { status: 400 },
    )
  }

  try {
    const db = await dbConnectGlobal()
    if (!db) {
      throw new Error('Соединение с базой данных не установлено')
    }

    const GameOrders = db.model('GameOrders')
    const updated = await GameOrders.findByIdAndUpdate(id, updates, {
      new: true,
    }).lean()

    if (!updated) {
      return NextResponse.json(
        { success: false, error: 'Заявка не найдена' },
        { status: 404 },
      )
    }

    return NextResponse.json(
      { success: true, data: normalizeGameOrderForCabinet(updated) },
      { status: 200 },
    )
  } catch (error) {
    console.error('Failed to update game order (app)', error)
    return NextResponse.json(
      { success: false, error: 'Не удалось обновить заявку' },
      { status: 500 },
    )
  }
}

export async function DELETE(_request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user || !isUserAdmin({ role: session.user.role })) {
    return NextResponse.json(
      { success: false, error: 'Недостаточно прав' },
      { status: 403 },
    )
  }

  const resolvedParams = await params
  const id = typeof resolvedParams?.id === 'string' ? resolvedParams.id : ''
  if (!id) {
    return NextResponse.json(
      { success: false, error: 'Некорректный идентификатор заявки' },
      { status: 400 },
    )
  }

  try {
    const db = await dbConnectGlobal()
    if (!db) {
      throw new Error('Соединение с базой данных не установлено')
    }

    const GameOrders = db.model('GameOrders')
    const deleted = await GameOrders.findByIdAndDelete(id).lean()

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: 'Заявка не найдена' },
        { status: 404 },
      )
    }

    return NextResponse.json(
      { success: true, data: { id } },
      { status: 200 },
    )
  } catch (error) {
    console.error('Failed to delete game order (app)', error)
    return NextResponse.json(
      { success: false, error: 'Не удалось удалить заявку' },
      { status: 500 },
    )
  }
}
