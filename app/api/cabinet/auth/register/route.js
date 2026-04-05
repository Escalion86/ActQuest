import { NextResponse } from 'next/server'

import registerPhoneUser from '@helpers/registerPhoneUser'
import { getSiteAccessControlsByLocation } from '@helpers/siteAccessControls'
import dbConnectGlobal from '@utils/dbConnectGlobal'
import logSiteEvent from '@helpers/logSiteEvent'

export async function POST(request) {
  const body = await request.json().catch(() => ({}))
  const { location, data } = body || {}
  const normalizedLocation =
    typeof location === 'string' && location.trim().length > 0
      ? location.trim().toLowerCase()
      : null

  try {
    if (!normalizedLocation) {
      return NextResponse.json(
        {
          success: false,
          errorCode: 'LOCATION_REQUIRED',
          error: 'Выберите город, в котором хотите зарегистрироваться.',
        },
        { status: 400 },
      )
    }

    const controls = await getSiteAccessControlsByLocation(normalizedLocation)
    if (!controls.allowSiteRegistration) {
      return NextResponse.json(
        {
          success: false,
          errorCode: 'REGISTRATION_DISABLED',
          error: 'Регистрация на сайте временно отключена для выбранного региона.',
        },
        { status: 403 },
      )
    }

    const result = await registerPhoneUser({
      location: normalizedLocation,
      rawData: data,
    })

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          errorCode: result.errorCode,
          error: result.errorMessage,
        },
        { status: 400 },
      )
    }

    const db = await dbConnectGlobal()
    await logSiteEvent({
      db,
      type: 'user_registered',
      location: normalizedLocation,
      message: 'Зарегистрирован новый пользователь',
      targetUserId: result?.user?.id ?? null,
      actorUserId: result?.user?.id ?? null,
      actorTelegramId: result?.user?.telegramId ?? null,
    })

    return NextResponse.json(
      {
        success: true,
        user: result.user,
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('Phone registration API error (app)', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Не удалось выполнить регистрацию. Попробуйте позже.',
      },
      { status: 500 },
    )
  }
}
