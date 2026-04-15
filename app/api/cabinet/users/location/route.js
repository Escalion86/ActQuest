import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import dbConnectGlobal from '@utils/dbConnectGlobal'
import { LOCATIONS } from '@server/serverConstants'

const isForceLocationDebugEnabled =
  process.env.FORCE_LOCATION_DEBUG === '1' || process.env.SESSION_DEBUG === '1'

const forceLocationServerLog = (stage, payload = null) => {
  if (!isForceLocationDebugEnabled) {
    return
  }

  const time = new Date().toISOString()
  if (payload === null || payload === undefined) {
    console.info(`[force-location][server] ${time} ${stage}`)
    return
  }

  console.info(`[force-location][server] ${time} ${stage}`, payload)
}

const resolveAllowedLocations = () =>
  Object.entries(LOCATIONS)
    .filter(([, value]) => !value.hidden)
    .map(([key]) => key)

const toFiniteNumberOrNull = (value) => {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    forceLocationServerLog('unauthorized')
    return NextResponse.json(
      { success: false, error: 'Необходима авторизация' },
      { status: 401 },
    )
  }

  const body = await request.json().catch(() => ({}))
  const rawLocation = body?.location
  const location =
    typeof rawLocation === 'string' ? rawLocation.trim().toLowerCase() : ''
  const allowedLocations = resolveAllowedLocations()
  forceLocationServerLog('request_received', {
    location,
    rawLocation,
    user: {
      globalUserId: session?.user?.globalUserId ?? null,
      _id: session?.user?._id ?? null,
      telegramId: session?.user?.telegramId ?? null,
      vkId: session?.user?.vkId ?? null,
      phone: session?.user?.phone ?? null,
      sessionLocation: session?.user?.location ?? null,
    },
  })

  if (!location || !allowedLocations.includes(location)) {
    forceLocationServerLog('invalid_location', {
      location,
      allowedLocations,
    })
    return NextResponse.json(
      {
        success: false,
        error: 'Некорректный город',
        allowedLocations,
      },
      { status: 400 },
    )
  }

  try {
    const globalDb = await dbConnectGlobal()
    if (!globalDb) {
      forceLocationServerLog('db_unavailable')
      return NextResponse.json(
        {
          success: false,
          error: 'Глобальная база пользователей недоступна',
        },
        { status: 503 },
      )
    }

    const Users = globalDb.model('Users')
    const globalUserId = session.user.globalUserId || session.user._id || null
    const telegramId = toFiniteNumberOrNull(session.user.telegramId)
    const vkId = toFiniteNumberOrNull(session.user.vkId)
    const phone = toFiniteNumberOrNull(session.user.phone)

    const candidateFilters = []
    if (globalUserId) {
      candidateFilters.push({ _id: String(globalUserId) })
    }
    if (telegramId !== null) {
      candidateFilters.push({ telegramId })
    }
    if (vkId !== null) {
      candidateFilters.push({ vkId })
    }
    if (phone !== null) {
      candidateFilters.push({ phone })
    }

    if (candidateFilters.length === 0) {
      forceLocationServerLog('no_candidate_filters')
      return NextResponse.json(
        {
          success: false,
          error: 'Не удалось определить пользователя для обновления города',
        },
        { status: 400 },
      )
    }

    let updatedUser = null
    for (const filter of candidateFilters) {
      forceLocationServerLog('try_filter', { filter })
      updatedUser = await Users.findOneAndUpdate(
        filter,
        {
          $set: {
            currentLocation: location,
            accountLocation: location,
          },
        },
        { returnDocument: 'after' },
      ).lean()

      if (updatedUser) {
        forceLocationServerLog('updated_by_filter', {
          filter,
          updatedUserId: updatedUser?._id ? String(updatedUser._id) : null,
          currentLocation: updatedUser?.currentLocation ?? null,
          accountLocation: updatedUser?.accountLocation ?? null,
        })
        break
      }
    }

    if (!updatedUser) {
      forceLocationServerLog('user_not_found', {
        candidateFilters,
      })
      return NextResponse.json(
        {
          success: false,
          error: 'Пользователь не найден в глобальной базе',
        },
        { status: 404 },
      )
    }

    return NextResponse.json(
      {
        success: true,
        location,
        globalUserId: updatedUser?._id ? String(updatedUser._id) : null,
      },
      { status: 200 },
    )
  } catch (error) {
    forceLocationServerLog('exception', {
      message: error?.message ?? null,
      stack: error?.stack ?? null,
    })
    console.error('Failed to update user location (app)', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Не удалось обновить город пользователя',
      },
      { status: 500 },
    )
  }
}

