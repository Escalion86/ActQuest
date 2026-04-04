import { NextResponse } from 'next/server'

import authenticateTelegramUser from '@helpers/authenticateTelegramUser'

export async function POST(request) {
  const { location, data } = (await request.json().catch(() => ({}))) || {}

  try {
    const result = await authenticateTelegramUser({ location, rawData: data })

    if (result.success) {
      return NextResponse.json(
        {
          success: true,
          user: {
            telegramId: result.user.telegramId,
            name: result.user.name,
            username: result.user.username,
          },
        },
        { status: 200 },
      )
    }

    const status = result.errorCode === 'DB_CONNECTION_FAILED' ? 500 : 400

    return NextResponse.json(
      {
        success: false,
        errorCode: result.errorCode,
        errorMessage: result.errorMessage,
        details: result.details ?? null,
      },
      { status },
    )
  } catch (error) {
    console.error('Telegram debug verify error', error)
    return NextResponse.json(
      {
        success: false,
        errorCode: 'UNEXPECTED_ERROR',
        errorMessage:
          'Непредвиденная ошибка при проверке данных авторизации Telegram.',
      },
      { status: 500 },
    )
  }
}
