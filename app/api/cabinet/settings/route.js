import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import dbConnectGlobal from '@utils/dbConnectGlobal'
import normalizeSiteSettings from '@helpers/normalizeSiteSettings'

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

const canManageSiteSettings = (role) =>
  normalizeRole(role) === 'admin' || normalizeRole(role) === 'dev'

const normalizeStringOrNull = (value) => {
  if (typeof value !== 'string') {
    return null
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const resolvePayload = (rawBody) => {
  const body =
    rawBody && typeof rawBody === 'object' && rawBody.data && typeof rawBody.data === 'object'
      ? rawBody.data
      : rawBody
  return {
    supportPhone: normalizeStringOrNull(body?.supportPhone),
    chatUrl: normalizeStringOrNull(body?.chatUrl),
    allowSiteAuth: Boolean(body?.allowSiteAuth),
    allowSiteRegistration: Boolean(body?.allowSiteRegistration),
    enableVkOneTap: Boolean(body?.enableVkOneTap),
  }
}

const getModel = async () => {
  const db = await dbConnectGlobal()
  if (!db) {
    throw new Error('База данных недоступна')
  }
  return db.model('SiteSettings')
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: 'Необходима авторизация' },
      { status: 401 },
    )
  }
  if (!canManageSiteSettings(session.user.role)) {
    return NextResponse.json(
      { success: false, error: 'Недостаточно прав' },
      { status: 403 },
    )
  }

  try {
    const SiteSettingsModel = await getModel()
    const settingsDoc = await SiteSettingsModel.findOne({}).lean()
    return NextResponse.json(
      { success: true, data: normalizeSiteSettings(settingsDoc) },
      { status: 200 },
    )
  } catch (error) {
    console.error('Failed to load cabinet settings', error)
    return NextResponse.json(
      { success: false, error: 'Не удалось загрузить настройки' },
      { status: 500 },
    )
  }
}

export async function PUT(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: 'Необходима авторизация' },
      { status: 401 },
    )
  }
  if (!canManageSiteSettings(session.user.role)) {
    return NextResponse.json(
      { success: false, error: 'Недостаточно прав' },
      { status: 403 },
    )
  }

  try {
    const SiteSettingsModel = await getModel()
    const rawBody = await request.json().catch(() => ({}))
    const payload = resolvePayload(rawBody)
    const existing = await SiteSettingsModel.findOne({}).lean()

    const updated = existing?._id
      ? await SiteSettingsModel.findByIdAndUpdate(
          existing._id,
          { $set: payload },
          { new: true },
        ).lean()
      : await SiteSettingsModel.create(payload)

    return NextResponse.json(
      { success: true, data: normalizeSiteSettings(updated) },
      { status: 200 },
    )
  } catch (error) {
    console.error('Failed to save cabinet settings', error)
    return NextResponse.json(
      { success: false, error: 'Не удалось сохранить настройки' },
      { status: 500 },
    )
  }
}
