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
  const normalized = normalizedRaw
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

const SETTINGS_CITY_KEYS = ['krsk', 'nrsk', 'ekb']

const normalizeLocationMap = (value) => {
  const source =
    value && typeof value === 'object' && !Array.isArray(value) ? value : {}

  return SETTINGS_CITY_KEYS.reduce((acc, key) => {
    acc[key] = normalizeStringOrNull(source[key])
    return acc
  }, {})
}

const resolvePrimaryFromLocationMap = (map) => {
  for (const key of SETTINGS_CITY_KEYS) {
    const current = normalizeStringOrNull(map?.[key])
    if (current) {
      return current
    }
  }
  return null
}

const resolvePayload = (rawBody) => {
  const body =
    rawBody && typeof rawBody === 'object' && rawBody.data && typeof rawBody.data === 'object'
      ? rawBody.data
      : rawBody
  const supportPhonesByLocation = normalizeLocationMap(body?.supportPhonesByLocation)
  const chatUrlsByLocation = normalizeLocationMap(body?.chatUrlsByLocation)
  const legacySupportPhone = normalizeStringOrNull(body?.supportPhone)
  const legacyChatUrl = normalizeStringOrNull(body?.chatUrl)

  return {
    supportPhone: legacySupportPhone ?? resolvePrimaryFromLocationMap(supportPhonesByLocation),
    chatUrl: legacyChatUrl ?? resolvePrimaryFromLocationMap(chatUrlsByLocation),
    supportPhonesByLocation,
    chatUrlsByLocation,
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
          { returnDocument: 'after' },
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

