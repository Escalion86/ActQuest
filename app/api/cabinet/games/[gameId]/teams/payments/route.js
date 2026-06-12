import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import { buildGameTeamPaymentsSummary } from '@server/gameTeamPaymentsSummary'
import { createTransaction } from '@server/transactionsService'
import dbConnectGlobal from '@utils/dbConnectGlobal'
import fetchTeamsForCabinet from '@helpers/fetchTeamsForCabinet'
import { toStringId } from '@helpers/idAndDate'

const normalizeRole = (value) => {
  if (typeof value !== 'string') return 'client'
  const normalized = value.trim().toLowerCase()
  return ['client', 'moder', 'admin', 'dev'].includes(normalized)
    ? normalized
    : 'client'
}

const isElevatedRole = (role) => role === 'admin' || role === 'dev'

const resolveSessionIdentity = (session) => {
  const sessionUser = session?.user ?? {}
  const userId = toStringId(
    sessionUser.globalUserId ??
      sessionUser.userId ??
      sessionUser._id ??
      sessionUser.id ??
      null,
  )
  const userTelegramId =
    sessionUser.telegramId !== null && sessionUser.telegramId !== undefined
      ? String(sessionUser.telegramId).trim()
      : null

  return {
    userId,
    userTelegramId,
    role: normalizeRole(sessionUser.role),
  }
}

const hasGamePaymentAccess = ({ identity, game }) => {
  if (!identity || !game) return false
  if (isElevatedRole(identity.role)) return true

  if (identity.role !== 'moder') return false
  if (!identity.userId) return false

  const moderators = Array.isArray(game?.moderators) ? game.moderators : []
  return moderators.some((moderator) => {
    if (!moderator) return false
    if (typeof moderator === 'string') {
      return toStringId(moderator) === identity.userId
    }
    return toStringId(moderator?.id ?? moderator?._id) === identity.userId
  })
}

const isObjectIdLike = (value) =>
  typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value.trim())

const findGameByAnyId = async (GamesModel, rawGameId, select) => {
  const normalized = toStringId(rawGameId)
  if (!normalized) return null

  if (isObjectIdLike(normalized)) {
    const byObjectId = await GamesModel.findById(normalized)
      .select(select)
      .lean()
    if (byObjectId?._id) return byObjectId
  }

  return GamesModel.findOne({ id: normalized }).select(select).lean()
}

const buildTransactionResponse = (transaction) => ({
  _id: toStringId(transaction?._id),
  direction: transaction?.direction || '',
  amount: Number(transaction?.amount) || 0,
  paymentMethod: transaction?.paymentMethod || '',
  status: transaction?.status || '',
  userId: toStringId(transaction?.userId) || null,
  gameId: toStringId(transaction?.gameId) || null,
  teamId: toStringId(transaction?.teamId) || null,
  gameTeamId: toStringId(transaction?.gameTeamId) || null,
  paidAt: transaction?.paidAt
    ? new Date(transaction.paidAt).toISOString()
    : null,
  createdAt: transaction?.createdAt
    ? new Date(transaction.createdAt).toISOString()
    : null,
  comment: typeof transaction?.comment === 'string' ? transaction.comment : '',
})

const loadContext = async ({ gameId, session }) => {
  const db = await dbConnectGlobal()
  if (!db) throw new Error('Соединение с базой данных не установлено')

  const Games = db.model('Games')
  const game = await findGameByAnyId(Games, gameId, {
    _id: 1,
    id: 1,
    name: 1,
    location: 1,
    moderators: 1,
  })
  if (!game?._id) {
    return {
      error: NextResponse.json(
        { success: false, error: 'Игра не найдена' },
        { status: 404 },
      ),
    }
  }

  const identity = resolveSessionIdentity(session)
  if (!hasGamePaymentAccess({ identity, game })) {
    return {
      error: NextResponse.json(
        { success: false, error: 'Недостаточно прав для управления оплатами' },
        { status: 403 },
      ),
    }
  }

  return { db, game, gameId: toStringId(game._id) }
}

const loadGameTeam = async ({ db, gameId, gameTeamId }) => {
  const GamesTeams = db.model('GamesTeams')
  const gameTeam = await GamesTeams.findOne({
    _id: gameTeamId,
    gameId,
  })
    .select({ _id: 1, teamId: 1, paidGame: 1 })
    .lean()

  return gameTeam
}

const calculateTotalPaid = (transactions) =>
  transactions.reduce((sum, item) => {
    if (item?.direction !== 'income' || item?.status !== 'completed') {
      return sum
    }
    const amount = Number(item?.amount)
    return Number.isFinite(amount) ? sum + amount : sum
  }, 0)

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
  const requestUrl = new URL(request.url)
  const gameTeamId = toStringId(requestUrl.searchParams.get('gameTeamId'))

  if (!gameId) {
    return NextResponse.json(
      { success: false, error: 'Не передан идентификатор игры' },
      { status: 400 },
    )
  }

  try {
    const context = await loadContext({ gameId, session })
    if (context.error) return context.error

    if (!gameTeamId) {
      const GamesTeams = context.db.model('GamesTeams')
      const gameTeams = await GamesTeams.find({ gameId: context.gameId })
        .select({ _id: 1, teamId: 1, paidGame: 1 })
        .lean()
      const teamIds = Array.from(
        new Set(gameTeams.map((item) => toStringId(item?.teamId)).filter(Boolean)),
      )
      const teams = teamIds.length
        ? await fetchTeamsForCabinet({
            db: context.db,
            teamIds,
            location: context.game?.location || null,
          })
        : []
      const Transactions = context.db.model('Transactions')
      const paymentTotals = gameTeams.length
        ? await Transactions.aggregate([
            {
              $match: {
                gameId: context.gameId,
                gameTeamId: {
                  $in: gameTeams
                    .map((item) => toStringId(item?._id))
                    .filter(Boolean),
                },
                direction: 'income',
                status: 'completed',
              },
            },
            {
              $group: {
                _id: '$gameTeamId',
                totalPaid: { $sum: '$amount' },
                transactionsCount: { $sum: 1 },
              },
            },
          ])
        : []
      const summary = buildGameTeamPaymentsSummary({
        gameTeams,
        teams,
        paymentTotals,
      })

      return NextResponse.json(
        {
          success: true,
          data: {
            gameId: context.gameId,
            ...summary,
          },
        },
        { status: 200 },
      )
    }

    const gameTeam = await loadGameTeam({
      db: context.db,
      gameId: context.gameId,
      gameTeamId,
    })
    if (!gameTeam?._id) {
      return NextResponse.json(
        { success: false, error: 'Регистрация команды на игру не найдена' },
        { status: 404 },
      )
    }

    const Transactions = context.db.model('Transactions')
    const transactions = await Transactions.find({
      gameId: context.gameId,
      teamId: toStringId(gameTeam.teamId),
      gameTeamId,
    })
      .sort({ paidAt: -1, createdAt: -1 })
      .lean()

    return NextResponse.json(
      {
        success: true,
        data: {
          gameId: context.gameId,
          gameTeamId,
          teamId: toStringId(gameTeam.teamId),
          paidGame: Boolean(gameTeam.paidGame),
          totalPaid: calculateTotalPaid(transactions),
          transactions: transactions.map(buildTransactionResponse),
        },
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('Game team payments API error', error)
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Не удалось загрузить оплаты команды',
      },
      { status: 400 },
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
  const payload = await request.json().catch(() => ({}))
  const gameTeamId = toStringId(payload?.gameTeamId)
  const userId = toStringId(payload?.userId)

  if (!gameId || !gameTeamId) {
    return NextResponse.json(
      { success: false, error: 'Не передан идентификатор игры или команды' },
      { status: 400 },
    )
  }

  if (!userId) {
    return NextResponse.json(
      { success: false, error: 'Необходимо выбрать игрока команды' },
      { status: 400 },
    )
  }

  try {
    const context = await loadContext({ gameId, session })
    if (context.error) return context.error

    const gameTeam = await loadGameTeam({
      db: context.db,
      gameId: context.gameId,
      gameTeamId,
    })
    if (!gameTeam?._id) {
      return NextResponse.json(
        { success: false, error: 'Регистрация команды на игру не найдена' },
        { status: 404 },
      )
    }

    const teamId = toStringId(gameTeam.teamId)
    const TeamsUsers = context.db.model('TeamsUsers')
    const membership = await TeamsUsers.findOne({ teamId, userId })
      .select({ _id: 1 })
      .lean()
    if (!membership?._id) {
      return NextResponse.json(
        { success: false, error: 'Выбранный игрок не состоит в команде' },
        { status: 400 },
      )
    }

    const created = await createTransaction({
      db: context.db,
      data: {
        direction: 'income',
        amount: payload?.amount,
        paymentMethod: payload?.paymentMethod || 'transfer',
        status: 'completed',
        userId,
        gameId: context.gameId,
        teamId,
        gameTeamId,
        paidAt: payload?.paidAt || new Date(),
        location: context.game?.location || null,
        comment: payload?.comment || 'Оплата участия команды в игре',
        source: 'manual',
        affectsUserBalance: false,
        meta: {
          ...(payload?.meta && typeof payload.meta === 'object'
            ? payload.meta
            : {}),
          teamPayment: true,
        },
      },
    })

    const Transactions = context.db.model('Transactions')
    const transactions = await Transactions.find({
      gameId: context.gameId,
      teamId,
      gameTeamId,
    })
      .sort({ paidAt: -1, createdAt: -1 })
      .lean()

    return NextResponse.json(
      {
        success: true,
        data: {
          transaction: buildTransactionResponse(created),
          totalPaid: calculateTotalPaid(transactions),
          transactions: transactions.map(buildTransactionResponse),
        },
      },
      { status: 201 },
    )
  } catch (error) {
    console.error('Game team payment create API error', error)
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Не удалось создать оплату команды',
      },
      { status: 400 },
    )
  }
}
