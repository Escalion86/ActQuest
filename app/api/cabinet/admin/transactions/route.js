import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import canManageTransactions from '@helpers/canManageTransactions'
import dbConnectGlobal from '@utils/dbConnectGlobal'
import { createTransaction } from '@server/transactionsService'

const parsePositiveInteger = (value, fallback) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric < 0) {
    return fallback
  }
  return Math.floor(numeric)
}

const checkAccess = async () => {
  const session = await getServerSession(authOptions)
  if (!session?.user || !canManageTransactions({ role: session.user.role })) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: 'Недостаточно прав' },
        { status: 403 },
      ),
      session,
    }
  }
  return { ok: true, session }
}

const attachDiscountToGameRegistration = async ({ db, payload }) => {
  if (
    payload?.paymentMethod !== 'discount' ||
    !payload?.gameId ||
    !payload?.userId ||
    payload?.gameTeamId
  ) {
    return payload
  }

  const TeamsUsers = db.model('TeamsUsers')
  const GamesTeams = db.model('GamesTeams')
  const memberships = await TeamsUsers.find({ userId: String(payload.userId) })
    .select({ teamId: 1 })
    .lean()
  const teamIds = memberships
    .map((item) => String(item?.teamId || '').trim())
    .filter(Boolean)
  const gameTeams = teamIds.length
    ? await GamesTeams.find({
        gameId: String(payload.gameId),
        teamId: { $in: teamIds },
      })
        .select({ _id: 1, teamId: 1 })
        .limit(2)
        .lean()
    : []

  if (gameTeams.length === 0) {
    throw new Error('Пользователь не зарегистрирован на выбранную игру')
  }
  if (gameTeams.length > 1) {
    throw new Error(
      'Пользователь зарегистрирован на игру в нескольких командах. Добавьте скидку через финансы нужной команды.',
    )
  }
  const [gameTeam] = gameTeams

  return {
    ...payload,
    direction: 'income',
    teamId: String(gameTeam.teamId),
    gameTeamId: String(gameTeam._id),
    affectsUserBalance: false,
    meta: {
      ...(payload.meta && typeof payload.meta === 'object' ? payload.meta : {}),
      teamPayment: true,
      adminGameDiscount: true,
    },
  }
}

export async function GET(request) {
  const access = await checkAccess()
  if (!access.ok) {
    return access.response
  }

  try {
    const db = await dbConnectGlobal()
    if (!db) {
      return NextResponse.json(
        { success: false, error: 'Не удалось подключиться к базе данных' },
        { status: 500 },
      )
    }

    const requestUrl = new URL(request.url)
    const offset = parsePositiveInteger(requestUrl.searchParams.get('offset'), 0)
    const limit = parsePositiveInteger(requestUrl.searchParams.get('limit'), 20)

    const query = {}
    if (
      typeof requestUrl.searchParams.get('direction') === 'string' &&
      requestUrl.searchParams.get('direction')
    ) {
      query.direction = requestUrl.searchParams.get('direction')
    }
    if (
      typeof requestUrl.searchParams.get('status') === 'string' &&
      requestUrl.searchParams.get('status')
    ) {
      query.status = requestUrl.searchParams.get('status')
    }

    const Transactions = db.model('Transactions')
    const docs = await Transactions.find(query)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit + 1)
      .lean()

    const hasMore = docs.length > limit
    const data = hasMore ? docs.slice(0, limit) : docs

    return NextResponse.json(
      {
        success: true,
        data,
        meta: { offset, limit, hasMore },
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('Transactions API error (app)', error)
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Ошибка обработки транзакции',
      },
      { status: 400 },
    )
  }
}

export async function POST(request) {
  const access = await checkAccess()
  if (!access.ok) {
    return access.response
  }

  try {
    const db = await dbConnectGlobal()
    if (!db) {
      return NextResponse.json(
        { success: false, error: 'Не удалось подключиться к базе данных' },
        { status: 500 },
      )
    }

    const body = await request.json().catch(() => ({}))
    const payload = await attachDiscountToGameRegistration({
      db,
      payload: body?.data ?? body ?? {},
    })
    const created = await createTransaction({ db, data: payload })
    return NextResponse.json({ success: true, data: created }, { status: 201 })
  } catch (error) {
    console.error('Transactions create API error (app)', error)
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Ошибка обработки транзакции',
      },
      { status: 400 },
    )
  }
}
