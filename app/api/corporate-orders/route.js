import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import { LOCATIONS } from '@server/serverConstants'
import { normalizePhoneForSubmit } from '@helpers/phoneInputMask'
import dbConnectGlobal from '@utils/dbConnectGlobal'

const MAX_TEXT_LENGTH = 2000

const normalizeString = (value, maxLength = 300) => {
  if (typeof value !== 'string') {
    return ''
  }
  return value.trim().slice(0, maxLength)
}

const normalizeLocation = (value) => {
  const normalized = normalizeString(value, 50).toLowerCase()
  return normalized && LOCATIONS?.[normalized] && !LOCATIONS[normalized]?.hidden
    ? normalized
    : ''
}

const normalizeDateOrNull = (value) => {
  if (!value) {
    return null
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const resolveSessionUserId = (sessionUser) => {
  const value =
    sessionUser?.globalUserId ??
    sessionUser?.userId ??
    sessionUser?._id ??
    sessionUser?.id ??
    null

  return value && typeof value.toString === 'function' ? value.toString() : null
}

export async function POST(request) {
  const rawBody = await request.json().catch(() => ({}))
  const payload =
    rawBody && typeof rawBody === 'object' && rawBody.data
      ? rawBody.data
      : rawBody

  const contactName = normalizeString(payload?.contactName)
  const rawPhone = normalizeString(payload?.phone)
  const phone = rawPhone ? normalizePhoneForSubmit(rawPhone) : ''
  const email = normalizeString(payload?.email).toLowerCase()
  const telegram = normalizeString(payload?.telegram)
  const location = normalizeLocation(payload?.location)
  const participantsCount = Number(payload?.participantsCount)
  const gameType = ['classic', 'photo', 'any'].includes(payload?.gameType)
    ? payload.gameType
    : 'any'

  if (!contactName) {
    return NextResponse.json(
      { success: false, error: 'Введите имя контактного лица' },
      { status: 400 },
    )
  }

  if (rawPhone && phone.length !== 11) {
    return NextResponse.json(
      { success: false, error: 'Введите номер телефона полностью' },
      { status: 400 },
    )
  }

  if (!phone && !email && !telegram) {
    return NextResponse.json(
      { success: false, error: 'Укажите телефон, email или Telegram' },
      { status: 400 },
    )
  }

  if (!location) {
    return NextResponse.json(
      { success: false, error: 'Выберите город из списка' },
      { status: 400 },
    )
  }

  try {
    const db = await dbConnectGlobal()
    if (!db) {
      throw new Error('Соединение с базой данных не установлено')
    }

    const session = await getServerSession(authOptions).catch(() => null)
    const GameOrders = db.model('GameOrders')
    const doc = await GameOrders.create({
      companyName: normalizeString(payload?.companyName),
      contactName,
      phone,
      email,
      telegram,
      location,
      preferredDate: normalizeDateOrNull(payload?.preferredDate),
      preferredTime: normalizeString(payload?.preferredTime, 20),
      participantsCount:
        Number.isFinite(participantsCount) && participantsCount > 0
          ? Math.floor(participantsCount)
          : null,
      gameType,
      selectedGameId: normalizeString(payload?.selectedGameId, 100) || null,
      comment: normalizeString(payload?.comment, MAX_TEXT_LENGTH),
      createdByUserId: resolveSessionUserId(session?.user),
    })

    return NextResponse.json(
      { success: true, data: { id: String(doc._id) } },
      { status: 201 },
    )
  } catch (error) {
    console.error('Failed to create corporate game order (app)', error)
    return NextResponse.json(
      { success: false, error: 'Не удалось отправить заявку' },
      { status: 500 },
    )
  }
}
