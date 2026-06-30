import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import fetchTeamsForCabinet from '@helpers/fetchTeamsForCabinet'
import { authOptions } from '@server/auth/authOptions'
import { LOCATIONS } from '@server/serverConstants'
import buildGameResultComputed from '@server/buildGameResultComputed'
import { buildGameTeamPaymentsSummary } from '@server/gameTeamPaymentsSummary'
import { createTransaction } from '@server/transactionsService'
import updateParticipantsClosedStats from '@server/updateParticipantsClosedStats'
import updateParticipantsRatings from '@server/updateParticipantsRatings'
import dbConnectGlobal from '@utils/dbConnectGlobal'
import { isScheduledGameForTeamEvent } from '@helpers/adminEventNotifications'
import logSiteEvent from '@helpers/logSiteEvent'
import { toStringId } from '@helpers/idAndDate'
import { getCaptainRoleQuery } from '@helpers/teamRoles'
import {
  hasPrequelAdjustments,
  normalizePrequelProgress,
} from '@helpers/normalizePrequel'
import fetchGameHistoryState from '@server/gameHistory/fetchGameHistoryState'
import recordGameHistoryEntry from '@server/gameHistory/recordGameHistoryEntry'
import buildGameHistorySnapshot from '@server/gameHistory/buildGameHistorySnapshot'
import {
  normalizeStoredTaskDistributionTemplate,
  normalizeTaskDistributionTemplate,
  validateTaskDistributionTemplate,
} from '@helpers/taskDistribution'

const MANUAL_TEAM_ADJUSTMENT_SOURCE = 'manual_team_adjustment'

const normalizeAdjustmentScope = (value) =>
  value === 'task_elapsed' ? 'task_elapsed' : 'total_adjustment'

const isCaptainForceClueAdding = (item) => {
  const source = typeof item?.source === 'string' ? item.source.trim() : ''
  return source === 'captain_force_clue'
}

const normalizeManualAdjustment = (item, index) => {
  if (!item || typeof item !== 'object') {
    return null
  }

  const rawName = typeof item.name === 'string' ? item.name.trim() : ''
  const seconds = Number(item.time)
  if (!Number.isFinite(seconds) || Math.round(seconds) === 0) {
    return null
  }
  const scope = normalizeAdjustmentScope(item.scope)
  const taskIndex = Number(item.taskIndex)
  const normalizedTaskIndex =
    scope === 'task_elapsed' && Number.isInteger(taskIndex) && taskIndex >= 0
      ? taskIndex
      : null
  if (scope === 'task_elapsed' && normalizedTaskIndex === null) {
    return null
  }
  const showInAdjustments =
    scope === 'total_adjustment'
      ? true
      : typeof item.showInAdjustments === 'boolean'
        ? item.showInAdjustments
        : true

  return {
    name: rawName || `Ручная корректировка #${index + 1}`,
    time: Math.round(seconds),
    source: MANUAL_TEAM_ADJUSTMENT_SOURCE,
    scope,
    showInAdjustments,
    ...(normalizedTaskIndex !== null ? { taskIndex: normalizedTaskIndex } : {}),
    createdAt: new Date(),
  }
}

const isManualTeamAdjustment = (item) =>
  item &&
  typeof item === 'object' &&
  (() => {
    const source = String(item.source || '')
      .trim()
      .toLowerCase()
    if (source === MANUAL_TEAM_ADJUSTMENT_SOURCE) {
      return true
    }

    // Backward-compatibility: старые ручные корректировки могли быть без source.
    // Считаем ручными записи без source и без task binding.
    const hasTaskId =
      typeof item.taskId === 'string' && item.taskId.trim() !== ''
    const hasTaskIndex =
      item?.taskIndex !== null &&
      item?.taskIndex !== undefined &&
      item?.taskIndex !== '' &&
      Number.isFinite(Number(item.taskIndex))
    return !source && !hasTaskId && !hasTaskIndex
  })()

const normalizeTimeAddingsForResponse = (value) =>
  (Array.isArray(value) ? value : [])
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null
      }
      const time = Number(item.time)
      if (!Number.isFinite(time) || Math.round(time) === 0) {
        return null
      }
      const source = typeof item.source === 'string' ? item.source.trim() : ''
      const taskId = typeof item.taskId === 'string' ? item.taskId.trim() : ''
      const taskIndex = Number.isFinite(Number(item.taskIndex))
        ? Number(item.taskIndex)
        : null
      return {
        name: typeof item.name === 'string' ? item.name : '',
        time: Math.round(time),
        source,
        taskId,
        taskIndex,
        scope: normalizeAdjustmentScope(item.scope),
        showInAdjustments: isCaptainForceClueAdding(item)
          ? false
          : normalizeAdjustmentScope(item.scope) === 'total_adjustment'
            ? true
            : item.showInAdjustments !== false,
      }
    })
    .filter(Boolean)

const normalizeGameTeamEntry = (doc) => {
  const id = toStringId(doc?._id ?? doc?.id)
  const teamId = toStringId(doc?.teamId)

  if (!id || !teamId) {
    return null
  }

  const prequelProgress = normalizePrequelProgress(doc?.prequelProgress)
  const prequelAdjustments = (
    Array.isArray(prequelProgress.appliedAdjustments)
      ? prequelProgress.appliedAdjustments
      : []
  )
    .map((item, index) => {
      const rawValue = Number(item?.value)
      if (!Number.isFinite(rawValue) || rawValue === 0) {
        return null
      }

      const adjustmentType = String(item?.type || '')
        .trim()
        .toLowerCase()
      const source = String(item?.source || '').trim()
      const code = String(item?.code || '').trim()
      const description = String(item?.description || '').trim()
      const isBonusAdjustment =
        adjustmentType === 'bonus' || source === 'bonus_code'
      const normalizedSeconds = Math.max(1, Math.abs(Math.round(rawValue)))
      const signedSeconds = isBonusAdjustment
        ? -normalizedSeconds
        : normalizedSeconds

      let name = description
      if (!name && code) {
        name = `Код приквела: ${code}`
      }
      if (!name && source === 'wrong_attempts_limit') {
        name = 'Штраф за лимит неверных кодов приквела'
      }
      if (!name) {
        name = isBonusAdjustment
          ? `Бонус приквела #${index + 1}`
          : `Штраф приквела #${index + 1}`
      }

      return {
        id: String(item?.id || `prequel-adjustment-${index}`),
        name,
        time: signedSeconds,
        source:
          source === 'wrong_attempts_limit'
            ? 'prequel_wrong_attempts_limit'
            : source === 'penalty_code'
              ? 'prequel_penalty_code'
              : 'prequel_bonus_code',
        scope: 'total_adjustment',
        showInAdjustments: true,
        code,
        description,
        createdAt:
          item?.createdAt instanceof Date
            ? item.createdAt.toISOString()
            : item?.createdAt
              ? String(item.createdAt)
              : null,
      }
    })
    .filter(Boolean)

  return {
    id,
    teamId,
    outOfCompetition: Boolean(doc?.outOfCompetition),
    paidGame: Boolean(doc?.paidGame),
    taskDistributionTemplate: normalizeStoredTaskDistributionTemplate(
      doc?.taskDistributionTemplate,
    ),
    taskSequence: Array.isArray(doc?.taskSequence)
      ? doc.taskSequence.map((item) => Number(item)).filter(Number.isInteger)
      : [],
    taskSequenceGeneratedAt: doc?.taskSequenceGeneratedAt
      ? new Date(doc.taskSequenceGeneratedAt).toISOString()
      : null,
    taskSequenceSource:
      typeof doc?.taskSequenceSource === 'string'
        ? doc.taskSequenceSource
        : 'linear',
    timeAddings: normalizeTimeAddingsForResponse(doc?.timeAddings),
    hasPrequelAdjustments: hasPrequelAdjustments(doc?.prequelProgress),
    prequelAdjustments,
  }
}

const isObjectIdLike = (value) =>
  typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value.trim())

const findGameByAnyId = async (GamesModel, rawGameId, select) => {
  const normalized = toStringId(rawGameId)
  if (!normalized) {
    return null
  }

  if (isObjectIdLike(normalized)) {
    const byObjectId = await GamesModel.findById(normalized)
      .select(select)
      .lean()
    if (byObjectId?._id) {
      return byObjectId
    }
  }

  return GamesModel.findOne({ id: normalized }).select(select).lean()
}

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

const isElevatedRole = (role) => role === 'admin' || role === 'dev'
const normalizeLocation = (value) =>
  typeof value === 'string' ? value.trim().toLowerCase() : ''
const resolveAllowedLocations = () =>
  Object.entries(LOCATIONS)
    .filter(([, value]) => !value?.hidden)
    .map(([key]) => key)
const resolveLocationLabel = (locationKey) => {
  const normalized = normalizeLocation(locationKey)
  if (!normalized) {
    return 'выбранный город'
  }
  const townRu = LOCATIONS?.[normalized]?.townRu
  if (!townRu || typeof townRu !== 'string') {
    return normalized
  }
  return townRu
}

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

const buildHistoryActorFromSession = (session) => ({
  userId:
    session?.user?.globalUserId ??
    session?.user?.userId ??
    session?.user?._id ??
    session?.user?.id ??
    null,
  telegramId:
    session?.user?.telegramId !== null &&
    session?.user?.telegramId !== undefined
      ? String(session.user.telegramId).trim()
      : null,
  role: typeof session?.user?.role === 'string' ? session.user.role : '',
  name: typeof session?.user?.name === 'string' ? session.user.name : '',
})

const hasGameManageAccess = ({ identity, game }) => {
  if (!identity || !game) {
    return false
  }

  if (isElevatedRole(identity.role)) {
    return true
  }

  const creatorUserId = toStringId(game?.creatorUserId)
  if (identity.userId && creatorUserId && identity.userId === creatorUserId) {
    return true
  }

  const creatorTelegramId =
    game?.creatorTelegramId !== null && game?.creatorTelegramId !== undefined
      ? String(game.creatorTelegramId).trim()
      : ''

  if (identity.userTelegramId && creatorTelegramId) {
    if (identity.userTelegramId === creatorTelegramId) {
      return true
    }
  }

  if (!identity.userId) {
    return false
  }

  const moderators = Array.isArray(game?.moderators) ? game.moderators : []
  return moderators.some((moderator) => {
    if (!moderator) {
      return false
    }

    if (typeof moderator === 'string') {
      return toStringId(moderator) === identity.userId
    }

    return toStringId(moderator?.id ?? moderator?._id) === identity.userId
  })
}

const hasGamePaymentAccess = ({ identity, game }) => {
  if (!identity || !game) {
    return false
  }

  if (isElevatedRole(identity.role)) {
    return true
  }

  if (identity.role !== 'moder' || !identity.userId) {
    return false
  }

  const moderators = Array.isArray(game?.moderators) ? game.moderators : []
  return moderators.some((moderator) => {
    if (!moderator) {
      return false
    }

    if (typeof moderator === 'string') {
      return toStringId(moderator) === identity.userId
    }

    return toStringId(moderator?.id ?? moderator?._id) === identity.userId
  })
}

const resolveMembershipFilter = ({ userId }) => (userId ? [{ userId }] : [])

const ensureGameAllowsRegistration = (game) => {
  const status = String(game?.status ?? '')
    .trim()
    .toLowerCase()
  if (status !== 'active') {
    return 'Запись на эту игру закрыта'
  }
  if (game?.registrationOpen === false) {
    return 'Запись на эту игру закрыта'
  }
  return null
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

const calculateTotalPaid = (transactions) =>
  transactions.reduce((sum, item) => {
    if (item?.direction !== 'income' || item?.status !== 'completed') {
      return sum
    }
    const amount = Number(item?.amount)
    return Number.isFinite(amount) ? sum + amount : sum
  }, 0)

const loadGamePaymentContext = async ({ db, gameId, session }) => {
  const GamesModel = db.model('Games')
  const game = await findGameByAnyId(GamesModel, gameId, {
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

  return {
    game,
    gameId: toStringId(game._id),
  }
}

const loadGameTeamPaymentEntry = async ({ db, gameId, gameTeamId }) => {
  const GamesTeamsModel = db.model('GamesTeams')
  return GamesTeamsModel.findOne({
    _id: gameTeamId,
    gameId,
  })
    .select({ _id: 1, teamId: 1, paidGame: 1 })
    .lean()
}

const buildTeamPaymentsSummaryResponse = async ({ db, game, gameId }) => {
  const GamesTeamsModel = db.model('GamesTeams')
  const gameTeams = await GamesTeamsModel.find({ gameId })
    .select({ _id: 1, teamId: 1, paidGame: 1 })
    .lean()
  const teamIds = Array.from(
    new Set(gameTeams.map((item) => toStringId(item?.teamId)).filter(Boolean)),
  )
  const teams = teamIds.length
    ? await fetchTeamsForCabinet({
        db,
        teamIds,
        location: game?.location || null,
      })
    : []

  const TransactionsModel = db.model('Transactions')
  const gameTeamIds = gameTeams
    .map((item) => toStringId(item?._id))
    .filter(Boolean)
  const paymentTotals = gameTeamIds.length
    ? await TransactionsModel.aggregate([
        {
          $match: {
            gameId,
            gameTeamId: { $in: gameTeamIds },
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
        gameId,
        ...summary,
      },
    },
    { status: 200 },
  )
}

const buildTeamPaymentsDetailResponse = async ({ db, gameId, gameTeamId }) => {
  const gameTeam = await loadGameTeamPaymentEntry({ db, gameId, gameTeamId })
  if (!gameTeam?._id) {
    return NextResponse.json(
      { success: false, error: 'Регистрация команды на игру не найдена' },
      { status: 404 },
    )
  }

  const teamId = toStringId(gameTeam.teamId)
  const TransactionsModel = db.model('Transactions')
  const transactions = await TransactionsModel.find({
    gameId,
    teamId,
    gameTeamId,
  })
    .sort({ paidAt: -1, createdAt: -1 })
    .lean()

  return NextResponse.json(
    {
      success: true,
      data: {
        gameId,
        gameTeamId,
        teamId,
        paidGame: Boolean(gameTeam.paidGame),
        totalPaid: calculateTotalPaid(transactions),
        transactions: transactions.map(buildTransactionResponse),
      },
    },
    { status: 200 },
  )
}

const handleTeamPaymentsGet = async ({ request, params, session }) => {
  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: 'Требуется авторизация' },
      { status: 401 },
    )
  }

  const resolvedParams = await params
  const gameId = toStringId(resolvedParams?.gameId)
  if (!gameId) {
    return NextResponse.json(
      { success: false, error: 'Не передан идентификатор игры' },
      { status: 400 },
    )
  }

  try {
    const db = await dbConnectGlobal()
    if (!db) {
      throw new Error('Соединение с базой данных не установлено')
    }

    const context = await loadGamePaymentContext({ db, gameId, session })
    if (context.error) {
      return context.error
    }

    const requestUrl = new URL(request.url)
    const gameTeamId = toStringId(requestUrl.searchParams.get('gameTeamId'))
    if (!gameTeamId) {
      return buildTeamPaymentsSummaryResponse({
        db,
        game: context.game,
        gameId: context.gameId,
      })
    }

    return buildTeamPaymentsDetailResponse({
      db,
      gameId: context.gameId,
      gameTeamId,
    })
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

const handleTeamPaymentCreate = async ({ payload, params, session }) => {
  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: 'Требуется авторизация' },
      { status: 401 },
    )
  }

  const resolvedParams = await params
  const gameId = toStringId(resolvedParams?.gameId)
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
    const db = await dbConnectGlobal()
    if (!db) {
      throw new Error('Соединение с базой данных не установлено')
    }

    const context = await loadGamePaymentContext({ db, gameId, session })
    if (context.error) {
      return context.error
    }

    const gameTeam = await loadGameTeamPaymentEntry({
      db,
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
    const TeamsUsersModel = db.model('TeamsUsers')
    const membership = await TeamsUsersModel.findOne({ teamId, userId })
      .select({ _id: 1 })
      .lean()
    if (!membership?._id) {
      return NextResponse.json(
        { success: false, error: 'Выбранный игрок не состоит в команде' },
        { status: 400 },
      )
    }

    const created = await createTransaction({
      db,
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

    const TransactionsModel = db.model('Transactions')
    const transactions = await TransactionsModel.find({
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

export async function GET(request, { params }) {
  const requestUrl = new URL(request.url)
  if (requestUrl.searchParams.get('scope') === 'payments') {
    const session = await getServerSession(authOptions)
    return handleTeamPaymentsGet({ request, params, session })
  }

  const resolvedParams = await params
  const { gameId } = resolvedParams ?? {}

  const normalizedGameId = toStringId(gameId)

  if (
    !normalizedGameId ||
    normalizedGameId === 'undefined' ||
    normalizedGameId === 'null'
  ) {
    return NextResponse.json(
      { success: false, error: 'Не передан идентификатор игры' },
      { status: 400 },
    )
  }

  try {
    const db = await dbConnectGlobal()

    if (!db) {
      throw new Error('Соединение с базой данных не установлено')
    }

    const GamesModel = db.model('Games')
    const game = await findGameByAnyId(GamesModel, normalizedGameId, {
      _id: 1,
      location: 1,
    })

    if (!game) {
      return NextResponse.json(
        { success: false, error: 'Игра не найдена' },
        { status: 404 },
      )
    }

    const gameLocationRaw =
      typeof game.location === 'string'
        ? game.location.trim().toLowerCase()
        : null
    const gameLocation = gameLocationRaw || null

    const GamesTeamsModel = db.model('GamesTeams')
    const normalizedResolvedGameId = toStringId(game?._id)
    const gameTeamsDocs = await GamesTeamsModel.find({
      gameId: normalizedResolvedGameId,
    })
      .select({
        _id: 1,
        teamId: 1,
        outOfCompetition: 1,
        paidGame: 1,
        taskDistributionTemplate: 1,
        taskSequence: 1,
        taskSequenceGeneratedAt: 1,
        taskSequenceSource: 1,
        timeAddings: 1,
        prequelProgress: 1,
      })
      .lean()

    const entries = Array.isArray(gameTeamsDocs)
      ? gameTeamsDocs.map((doc) => normalizeGameTeamEntry(doc)).filter(Boolean)
      : []
    const gameTeamIds = entries.map((entry) => entry.id).filter(Boolean)
    const TransactionsModel = db.model('Transactions')
    const paymentTotals = gameTeamIds.length
      ? await TransactionsModel.aggregate([
          {
            $match: {
              gameId: normalizedResolvedGameId,
              gameTeamId: { $in: gameTeamIds },
              direction: 'income',
              status: 'completed',
            },
          },
          {
            $group: {
              _id: '$gameTeamId',
              totalPaid: { $sum: '$amount' },
            },
          },
        ])
      : []
    const paymentTotalsMap = new Map(
      paymentTotals.map((item) => [
        toStringId(item?._id),
        Number(item?.totalPaid) || 0,
      ]),
    )
    const entriesWithPaymentTotals = entries.map((entry) => ({
      ...entry,
      totalPaid: paymentTotalsMap.get(entry.id) || 0,
    }))

    const uniqueTeamIds = Array.from(
      new Set(entriesWithPaymentTotals.map((entry) => entry.teamId)),
    )

    const teams = uniqueTeamIds.length
      ? await fetchTeamsForCabinet({
          db,
          teamIds: uniqueTeamIds,
          location: gameLocation,
        })
      : []

    const allTeams = await fetchTeamsForCabinet({
      db,
      location: gameLocation,
      limit: 500,
      offset: 0,
    })

    return NextResponse.json(
      {
        success: true,
        data: {
          entries: entriesWithPaymentTotals,
          teams,
          allTeams: Array.isArray(allTeams) ? allTeams : [],
        },
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('Failed to load game teams for cabinet (app)', error)
    return NextResponse.json(
      { success: false, error: 'Не удалось загрузить команды игры' },
      { status: 500 },
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
  const action =
    typeof payload?.action === 'string' ? payload.action.trim() : ''
  if (action === 'create_team_payment') {
    return handleTeamPaymentCreate({ payload, params, session })
  }

  const teamId = toStringId(payload?.teamId)

  if (!gameId || !teamId) {
    return NextResponse.json(
      { success: false, error: 'Не передан идентификатор игры или команды' },
      { status: 400 },
    )
  }

  try {
    const db = await dbConnectGlobal()
    if (!db) {
      throw new Error('Соединение с базой данных не установлено')
    }

    const GamesModel = db.model('Games')
    const TeamsModel = db.model('Teams')
    const TeamsUsersModel = db.model('TeamsUsers')
    const GamesTeamsModel = db.model('GamesTeams')

    const game = await findGameByAnyId(GamesModel, gameId, {
      _id: 1,
      name: 1,
      status: 1,
      registrationOpen: 1,
      location: 1,
      dateStartFact: 1,
      dateEndFact: 1,
    })
    if (!game?._id) {
      return NextResponse.json(
        { success: false, error: 'Игра не найдена' },
        { status: 404 },
      )
    }
    const normalizedResolvedGameId = toStringId(game._id)

    const registrationError = ensureGameAllowsRegistration(game)
    if (registrationError) {
      return NextResponse.json(
        { success: false, error: registrationError },
        { status: 403 },
      )
    }

    const team = await TeamsModel.findById(teamId)
      .select({ _id: 1, location: 1, name: 1 })
      .lean()
    if (!team?._id) {
      return NextResponse.json(
        { success: false, error: 'Команда не найдена' },
        { status: 404 },
      )
    }

    const identity = resolveSessionIdentity(session)
    const membershipOr = resolveMembershipFilter(identity)
    if (!isElevatedRole(identity.role)) {
      if (membershipOr.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: 'Недостаточно прав для регистрации команды',
          },
          { status: 403 },
        )
      }

      const captainMembership = await TeamsUsersModel.findOne({
        teamId,
        role: getCaptainRoleQuery(),
        $or: membershipOr,
      })
        .select({ _id: 1 })
        .lean()

      if (!captainMembership?._id) {
        return NextResponse.json(
          {
            success: false,
            error: 'Регистрация доступна только капитану команды',
          },
          { status: 403 },
        )
      }

      const gameLocation = normalizeLocation(game?.location)
      const teamLocation = normalizeLocation(team?.location)
      if (gameLocation && gameLocation !== teamLocation) {
        const captainMemberships = await TeamsUsersModel.find({
          role: getCaptainRoleQuery(),
          $or: membershipOr,
        })
          .select({ teamId: 1 })
          .lean()

        const captainTeamIds = Array.from(
          new Set(
            captainMemberships
              .map((membership) => toStringId(membership?.teamId))
              .filter(Boolean),
          ),
        )

        const captainTeamsInGameLocation = captainTeamIds.length
          ? await TeamsModel.find({
              _id: { $in: captainTeamIds },
              location: gameLocation,
            })
              .select({ _id: 1 })
              .lean()
          : []

        if (!captainTeamsInGameLocation.length) {
          const cityLabel = resolveLocationLabel(gameLocation)
          return NextResponse.json(
            {
              success: false,
              error: `У вас нет команд, где вы капитан, для города «${cityLabel}».`,
            },
            { status: 403 },
          )
        }

        return NextResponse.json(
          {
            success: false,
            error:
              'Выбранная команда привязана к другому городу. Для регистрации выберите команду из того же города, что и игра.',
          },
          { status: 403 },
        )
      }
    }

    const existing = await GamesTeamsModel.findOne({
      gameId: normalizedResolvedGameId,
      teamId,
    })
      .select({ _id: 1 })
      .lean()
    if (existing?._id) {
      return NextResponse.json(
        { success: false, error: 'Команда уже зарегистрирована на эту игру' },
        { status: 409 },
      )
    }

    const beforeHistoryState = await fetchGameHistoryState({
      db,
      gameId: normalizedResolvedGameId,
      game,
    })

    const created = await GamesTeamsModel.create({
      gameId: normalizedResolvedGameId,
      teamId,
    })

    if (isScheduledGameForTeamEvent(game)) {
      await logSiteEvent({
        db,
        type: 'team_registered_to_game',
        location: normalizeLocation(game?.location),
        message: `Команда «${typeof team?.name === 'string' ? team.name : ''}» зарегистрирована на игру «${typeof game?.name === 'string' ? game.name : ''}»`,
        actorUserId: identity.userId,
        actorTelegramId: null,
        teamId,
        teamName: typeof team?.name === 'string' ? team.name : '',
        gameId: normalizedResolvedGameId,
        gameName: typeof game?.name === 'string' ? game.name : '',
      })
    }

    const afterHistoryState = await fetchGameHistoryState({
      db,
      gameId: normalizedResolvedGameId,
      game,
    })
    await recordGameHistoryEntry({
      db,
      gameId: normalizedResolvedGameId,
      location: normalizeLocation(game?.location),
      actionType: 'team_registered',
      entityScope: 'game_teams',
      actor: buildHistoryActorFromSession(session),
      beforeState: beforeHistoryState,
      afterState: afterHistoryState,
      snapshot: buildGameHistorySnapshot(afterHistoryState),
      context: {
        summary: `Команда «${typeof team?.name === 'string' ? team.name : ''}» зарегистрирована на игру`,
      },
    })

    return NextResponse.json(
      {
        success: true,
        data: {
          id: toStringId(created?._id),
          gameId: normalizedResolvedGameId,
          teamId,
        },
      },
      { status: 201 },
    )
  } catch (error) {
    console.error('Failed to register team for game (app)', error)
    return NextResponse.json(
      { success: false, error: 'Не удалось зарегистрироваться на игру' },
      { status: 500 },
    )
  }
}

export async function DELETE(request, { params }) {
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
  const teamIdsRaw = Array.isArray(payload?.teamIds) ? payload.teamIds : []
  const teamIds = Array.from(
    new Set(teamIdsRaw.map((value) => toStringId(value)).filter(Boolean)),
  )

  if (!gameId || teamIds.length === 0) {
    return NextResponse.json(
      { success: false, error: 'Не передан идентификатор игры или команд' },
      { status: 400 },
    )
  }

  try {
    const db = await dbConnectGlobal()
    if (!db) {
      throw new Error('Соединение с базой данных не установлено')
    }

    const GamesModel = db.model('Games')
    const TeamsModel = db.model('Teams')
    const TeamsUsersModel = db.model('TeamsUsers')
    const GamesTeamsModel = db.model('GamesTeams')

    const game = await findGameByAnyId(GamesModel, gameId, {
      _id: 1,
      name: 1,
      location: 1,
      status: 1,
      dateStartFact: 1,
      dateEndFact: 1,
    })
    if (!game?._id) {
      return NextResponse.json(
        { success: false, error: 'Игра не найдена' },
        { status: 404 },
      )
    }
    const normalizedResolvedGameId = toStringId(game._id)

    const identity = resolveSessionIdentity(session)
    if (!isElevatedRole(identity.role)) {
      const membershipOr = resolveMembershipFilter(identity)
      if (membershipOr.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Недостаточно прав для отмены регистрации' },
          { status: 403 },
        )
      }

      const captainMemberships = await TeamsUsersModel.find({
        teamId: { $in: teamIds },
        role: getCaptainRoleQuery(),
        $or: membershipOr,
      })
        .select({ teamId: 1 })
        .lean()

      const allowedTeamIds = new Set(
        captainMemberships
          .map((item) => toStringId(item?.teamId))
          .filter(Boolean),
      )
      const hasForbiddenTeam = teamIds.some(
        (teamIdValue) => !allowedTeamIds.has(teamIdValue),
      )
      if (hasForbiddenTeam) {
        return NextResponse.json(
          {
            success: false,
            error: 'Отмена регистрации доступна только капитану команды',
          },
          { status: 403 },
        )
      }
    }

    const existingRegistrations = await GamesTeamsModel.find({
      gameId: normalizedResolvedGameId,
      teamId: { $in: teamIds },
    })
      .select({ teamId: 1 })
      .lean()
    const deletedTeamIds = Array.from(
      new Set(
        existingRegistrations
          .map((entry) => toStringId(entry?.teamId))
          .filter(Boolean),
      ),
    )

    const teamsForLog = await TeamsModel.find({ _id: { $in: deletedTeamIds } })
      .select({ _id: 1, name: 1 })
      .lean()
    const teamNameById = teamsForLog.reduce((acc, item) => {
      const id = toStringId(item?._id)
      if (id) {
        acc[id] = typeof item?.name === 'string' ? item.name : ''
      }
      return acc
    }, {})

    const beforeHistoryState = await fetchGameHistoryState({
      db,
      gameId: normalizedResolvedGameId,
      game,
    })

    const deleteResult = await GamesTeamsModel.deleteMany({
      gameId: normalizedResolvedGameId,
      teamId: { $in: deletedTeamIds },
    })

    if (
      Number(deleteResult?.deletedCount || 0) > 0 &&
      isScheduledGameForTeamEvent(game)
    ) {
      await Promise.all(
        deletedTeamIds.map((currentTeamId) =>
          logSiteEvent({
            db,
            type: 'team_unregistered_from_game',
            location: normalizeLocation(game?.location),
            message: `Команда «${teamNameById[currentTeamId] || ''}» снята с регистрации на игру «${typeof game?.name === 'string' ? game.name : ''}»`,
            actorUserId: identity.userId,
            actorTelegramId: null,
            teamId: currentTeamId,
            teamName: teamNameById[currentTeamId] || '',
            gameId: normalizedResolvedGameId,
            gameName: typeof game?.name === 'string' ? game.name : '',
          }),
        ),
      )
    }

    if (Number(deleteResult?.deletedCount || 0) > 0) {
      const afterHistoryState = await fetchGameHistoryState({
        db,
        gameId: normalizedResolvedGameId,
        game,
      })
      const deletedNames = deletedTeamIds
        .map((currentTeamId) => teamNameById[currentTeamId] || '')
        .filter(Boolean)

      await recordGameHistoryEntry({
        db,
        gameId: normalizedResolvedGameId,
        location: normalizeLocation(game?.location),
        actionType: 'team_unregistered',
        entityScope: 'game_teams',
        actor: buildHistoryActorFromSession(session),
        beforeState: beforeHistoryState,
        afterState: afterHistoryState,
        snapshot: buildGameHistorySnapshot(afterHistoryState),
        context: {
          summary:
            deletedNames.length > 1
              ? `Сняты с игры команды: ${deletedNames.join(', ')}`
              : `Команда «${deletedNames[0] || ''}» снята с игры`,
        },
      })
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          deletedCount: Number(deleteResult?.deletedCount || 0),
          gameId: normalizedResolvedGameId,
          teamIds,
        },
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('Failed to cancel team registration for game (app)', error)
    return NextResponse.json(
      { success: false, error: 'Не удалось отменить регистрацию команды' },
      { status: 500 },
    )
  }
}

export async function PATCH(request, { params }) {
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
  const action =
    typeof payload?.action === 'string' ? payload.action.trim() : ''

  try {
    const db = await dbConnectGlobal()
    if (!db) {
      throw new Error('Соединение с базой данных не установлено')
    }

    const identity = resolveSessionIdentity(session)
    const GamesModel = db.model('Games')
    const GamesTeamsModel = db.model('GamesTeams')
    const TeamsModel = db.model('Teams')

    const game = await findGameByAnyId(GamesModel, gameId, {
      _id: 1,
      id: 1,
      name: 1,
      status: 1,
      location: 1,
      creatorTelegramId: 1,
      creatorUserId: 1,
      moderators: 1,
      tasks: 1,
      taskDuration: 1,
      taskFailurePenalty: 1,
      manyCodesPenalty: 1,
      type: 1,
      dateStartFact: 1,
      dateEndFact: 1,
      result: 1,
    })

    if (!game?._id) {
      return NextResponse.json(
        { success: false, error: 'Игра не найдена' },
        { status: 404 },
      )
    }

    if (!hasGameManageAccess({ identity, game })) {
      return NextResponse.json(
        {
          success: false,
          error: 'Недостаточно прав для управления командами игры',
        },
        { status: 403 },
      )
    }

    const normalizedResolvedGameId = toStringId(game._id)

    if (action === 'update_task_distribution_template') {
      const gameTeamId = toStringId(payload?.gameTeamId)
      if (!gameId || !gameTeamId) {
        return NextResponse.json(
          {
            success: false,
            error: 'Не передан идентификатор игры или регистрации',
          },
          { status: 400 },
        )
      }

      const currentGameTeam = await GamesTeamsModel.findOne({
        _id: gameTeamId,
        gameId: normalizedResolvedGameId,
      })
        .select({ _id: 1, teamId: 1 })
        .lean()

      if (!currentGameTeam?._id) {
        return NextResponse.json(
          { success: false, error: 'Регистрация команды на игру не найдена' },
          { status: 404 },
        )
      }

      const tasksCount = Array.isArray(game.tasks) ? game.tasks.length : 0
      const template = normalizeTaskDistributionTemplate(
        payload?.taskDistributionTemplate,
        tasksCount,
      )

      if (template.length > 0) {
        const validation = validateTaskDistributionTemplate(template, tasksCount)
        if (!validation.valid) {
          return NextResponse.json(
            {
              success: false,
              error:
                validation.messages[0] ||
                'Индивидуальный шаблон распределения некорректен',
            },
            { status: 400 },
          )
        }
      }

      await GamesTeamsModel.updateOne(
        { _id: gameTeamId, gameId: normalizedResolvedGameId },
        { $set: { taskDistributionTemplate: template } },
      )

      return NextResponse.json(
        {
          success: true,
          data: {
            gameId: normalizedResolvedGameId,
            gameTeamId,
            teamId: toStringId(currentGameTeam?.teamId) || '',
            taskDistributionTemplate: template,
          },
        },
        { status: 200 },
      )
    }

    if (action === 'update_team_profile') {
      const teamId = toStringId(payload?.teamId)
      const update =
        payload?.update && typeof payload.update === 'object'
          ? payload.update
          : {}

      if (!gameId || !teamId) {
        return NextResponse.json(
          {
            success: false,
            error: 'Не передан идентификатор игры или команды',
          },
          { status: 400 },
        )
      }

      const linkedTeam = await GamesTeamsModel.findOne({
        gameId: normalizedResolvedGameId,
        teamId,
      })
        .select({ _id: 1 })
        .lean()

      if (!linkedTeam?._id) {
        return NextResponse.json(
          {
            success: false,
            error: 'Команда не зарегистрирована на эту игру',
          },
          { status: 404 },
        )
      }

      const name =
        typeof update?.name === 'string' ? update.name.trim().slice(0, 120) : ''
      const description =
        typeof update?.description === 'string'
          ? update.description.trim().slice(0, 2000)
          : ''
      const image = typeof update?.image === 'string' ? update.image : null
      const open = typeof update?.open === 'boolean' ? update.open : undefined
      const rawLocation =
        typeof update?.location === 'string' ? update.location : ''
      const normalizedLocation = normalizeLocation(rawLocation)
      const shouldUpdateLocation = normalizedLocation.length > 0
      const allowedLocations = resolveAllowedLocations()

      if (!name) {
        return NextResponse.json(
          { success: false, error: 'Введите название команды' },
          { status: 400 },
        )
      }
      if (
        shouldUpdateLocation &&
        !allowedLocations.includes(normalizedLocation)
      ) {
        return NextResponse.json(
          { success: false, error: 'Некорректный город команды' },
          { status: 400 },
        )
      }

      const updatedTeam = await TeamsModel.findByIdAndUpdate(
        teamId,
        {
          $set: {
            name,
            name_lowered: name.toLowerCase(),
            description,
            image,
            ...(typeof open === 'boolean' ? { open } : {}),
            ...(shouldUpdateLocation ? { location: normalizedLocation } : {}),
          },
        },
        { returnDocument: 'after' },
      )
        .select({
          _id: 1,
          name: 1,
          name_lowered: 1,
          description: 1,
          image: 1,
          open: 1,
          location: 1,
          updatedAt: 1,
        })
        .lean()

      if (!updatedTeam?._id) {
        return NextResponse.json(
          { success: false, error: 'Команда не найдена' },
          { status: 404 },
        )
      }

      return NextResponse.json(
        {
          success: true,
          data: {
            teamId: toStringId(updatedTeam._id),
            team: updatedTeam,
          },
        },
        { status: 200 },
      )
    }

    if (action === 'update_time_addings') {
      const gameTeamId = toStringId(payload?.gameTeamId)
      const manualAdjustmentsRaw = Array.isArray(payload?.manualAdjustments)
        ? payload.manualAdjustments
        : []

      if (!gameId || !gameTeamId) {
        return NextResponse.json(
          {
            success: false,
            error: 'Не передан идентификатор игры или регистрации',
          },
          { status: 400 },
        )
      }

      const currentGameTeam = await GamesTeamsModel.findOne({
        _id: gameTeamId,
        gameId: normalizedResolvedGameId,
      })
        .select({ _id: 1, teamId: 1, timeAddings: 1 })
        .lean()

      if (!currentGameTeam?._id) {
        return NextResponse.json(
          { success: false, error: 'Регистрация команды на игру не найдена' },
          { status: 404 },
        )
      }

      const beforeHistoryState = await fetchGameHistoryState({
        db,
        gameId: normalizedResolvedGameId,
        game,
      })

      const manualAdjustments = manualAdjustmentsRaw
        .map((item, index) => normalizeManualAdjustment(item, index))
        .filter(Boolean)

      const preservedAutomaticAddings = (
        Array.isArray(currentGameTeam.timeAddings)
          ? currentGameTeam.timeAddings
          : []
      ).filter((item) => !isManualTeamAdjustment(item))

      const nextTimeAddings = [
        ...preservedAutomaticAddings,
        ...manualAdjustments,
      ]

      await GamesTeamsModel.updateOne(
        { _id: gameTeamId, gameId: normalizedResolvedGameId },
        { $set: { timeAddings: nextTimeAddings } },
      )

      const currentResult =
        game?.result && typeof game.result === 'object' ? game.result : {}
      const currentGameTeamTeamId = toStringId(currentGameTeam?.teamId)
      const snapshotGameTeams = Array.isArray(currentResult?.gameTeams)
        ? currentResult.gameTeams.map((entry) => {
            const entryId = toStringId(entry?._id ?? entry?.id)
            const entryTeamId = toStringId(entry?.teamId)
            const isSameEntry =
              (entryId && entryId === gameTeamId) ||
              (currentGameTeamTeamId &&
                entryTeamId &&
                entryTeamId === currentGameTeamTeamId)

            if (!isSameEntry) {
              return entry
            }

            return {
              ...entry,
              timeAddings: nextTimeAddings,
            }
          })
        : null
      const shouldRebuildResult = ['finished', 'closed'].includes(
        String(game?.status || '')
          .trim()
          .toLowerCase(),
      )

      let resultUpdated = false
      let ratingUpdated = false
      let statsUpdated = false

      if (shouldRebuildResult) {
        try {
          const gameForRebuild =
            Array.isArray(snapshotGameTeams) && snapshotGameTeams.length > 0
              ? {
                  ...game,
                  result: {
                    ...currentResult,
                    gameTeams: snapshotGameTeams,
                  },
                }
              : game

          const built = await buildGameResultComputed({ game: gameForRebuild })
          const nextResult = {
            ...(gameForRebuild?.result &&
            typeof gameForRebuild.result === 'object'
              ? gameForRebuild.result
              : currentResult),
            ...(Array.isArray(snapshotGameTeams) && snapshotGameTeams.length > 0
              ? { gameTeams: snapshotGameTeams }
              : {}),
            teamsPlaces: built.teamsPlaces,
            computed: built.computed,
          }

          const updatedGame = await GamesModel.findByIdAndUpdate(
            normalizedResolvedGameId,
            { $set: { result: nextResult } },
            { returnDocument: 'after' },
          ).lean()

          resultUpdated = Boolean(updatedGame?._id)

          if (
            String(updatedGame?.status || '')
              .trim()
              .toLowerCase() === 'closed'
          ) {
            await updateParticipantsClosedStats({
              db,
              game: updatedGame || { ...game, result: nextResult },
            })
            statsUpdated = true

            await updateParticipantsRatings({
              db,
              game: updatedGame || { ...game, result: nextResult },
              updateAllEntities: true,
            })
            ratingUpdated = true
          }
        } catch (rebuildError) {
          if (rebuildError?.code !== 'RESULT_SNAPSHOTS_MISSING') {
            throw rebuildError
          }

          if (
            Array.isArray(snapshotGameTeams) &&
            snapshotGameTeams.length > 0
          ) {
            await GamesModel.updateOne(
              { _id: normalizedResolvedGameId },
              { $set: { 'result.gameTeams': snapshotGameTeams } },
            )
          }
        }
      } else if (
        Array.isArray(snapshotGameTeams) &&
        snapshotGameTeams.length > 0
      ) {
        await GamesModel.updateOne(
          { _id: normalizedResolvedGameId },
          { $set: { 'result.gameTeams': snapshotGameTeams } },
        )
      }

      const updatedGameForHistory = await GamesModel.findById(
        normalizedResolvedGameId,
      ).lean()
      const afterHistoryState = await fetchGameHistoryState({
        db,
        gameId: normalizedResolvedGameId,
        game: updatedGameForHistory,
      })
      await recordGameHistoryEntry({
        db,
        gameId: normalizedResolvedGameId,
        location: normalizeLocation(game?.location),
        actionType: 'team_adjustments_updated',
        entityScope: 'game_teams',
        actor: buildHistoryActorFromSession(session),
        beforeState: beforeHistoryState,
        afterState: afterHistoryState,
        snapshot: buildGameHistorySnapshot(afterHistoryState),
        context: {
          summary: 'Обновлены ручные корректировки команды в игре',
        },
      })

      return NextResponse.json(
        {
          success: true,
          data: {
            gameId: normalizedResolvedGameId,
            gameTeamId,
            manualAdjustments: manualAdjustments.map((item) => ({
              name: item.name,
              time: item.time,
              source: item.source,
            })),
            resultUpdated,
            ratingUpdated,
            statsUpdated,
          },
        },
        { status: 200 },
      )
    }

    if (action === 'update_paid_game') {
      const gameTeamId = toStringId(payload?.gameTeamId)
      const paidGame = Boolean(payload?.paidGame)

      if (!gameId || !gameTeamId) {
        return NextResponse.json(
          {
            success: false,
            error: 'Не передан идентификатор игры или регистрации',
          },
          { status: 400 },
        )
      }

      const currentGameTeam = await GamesTeamsModel.findOne({
        _id: gameTeamId,
        gameId: normalizedResolvedGameId,
      })
        .select({ _id: 1, teamId: 1 })
        .lean()

      if (!currentGameTeam?._id) {
        return NextResponse.json(
          { success: false, error: 'Регистрация команды на игру не найдена' },
          { status: 404 },
        )
      }

      await GamesTeamsModel.updateOne(
        { _id: gameTeamId, gameId: normalizedResolvedGameId },
        { $set: { paidGame } },
      )

      return NextResponse.json(
        {
          success: true,
          data: {
            gameId: normalizedResolvedGameId,
            gameTeamId,
            teamId: toStringId(currentGameTeam?.teamId) || '',
            paidGame,
          },
        },
        { status: 200 },
      )
    }

    const gameTeamId = toStringId(payload?.gameTeamId)
    const outOfCompetition = Boolean(payload?.outOfCompetition)
    if (!gameId || !gameTeamId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Не передан идентификатор игры или регистрации',
        },
        { status: 400 },
      )
    }

    const currentGameTeam = await GamesTeamsModel.findOne({
      _id: gameTeamId,
      gameId: normalizedResolvedGameId,
    })
      .select({ _id: 1, teamId: 1, outOfCompetition: 1 })
      .lean()

    if (!currentGameTeam?._id) {
      return NextResponse.json(
        { success: false, error: 'Регистрация команды на игру не найдена' },
        { status: 404 },
      )
    }

    const beforeHistoryState = await fetchGameHistoryState({
      db,
      gameId: normalizedResolvedGameId,
      game,
    })

    await GamesTeamsModel.updateOne(
      { _id: gameTeamId, gameId: normalizedResolvedGameId },
      { $set: { outOfCompetition } },
    )

    const currentResult =
      game?.result && typeof game.result === 'object' ? game.result : {}
    const snapshotGameTeams = Array.isArray(currentResult?.gameTeams)
      ? currentResult.gameTeams.map((entry) => {
          if (
            toStringId(entry?._id ?? entry?.id) === gameTeamId ||
            toStringId(entry?.teamId) === toStringId(currentGameTeam?.teamId)
          ) {
            return {
              ...entry,
              outOfCompetition,
            }
          }
          return entry
        })
      : []

    let resultUpdated = false
    let ratingUpdated = false
    let statsUpdated = false

    const shouldRebuildResult = ['finished', 'closed'].includes(
      String(game?.status || '')
        .trim()
        .toLowerCase(),
    )

    if (shouldRebuildResult) {
      try {
        const gameForRebuild = {
          ...game,
          result: {
            ...currentResult,
            gameTeams: snapshotGameTeams,
          },
        }
        const built = await buildGameResultComputed({ game: gameForRebuild })

        const nextResult = {
          ...currentResult,
          gameTeams: snapshotGameTeams,
          teamsPlaces: built.teamsPlaces,
          computed: built.computed,
        }

        const updatedGame = await GamesModel.findByIdAndUpdate(
          normalizedResolvedGameId,
          { $set: { result: nextResult } },
          { returnDocument: 'after' },
        ).lean()

        resultUpdated = Boolean(updatedGame?._id)

        if (
          String(updatedGame?.status || '')
            .trim()
            .toLowerCase() === 'closed'
        ) {
          await updateParticipantsClosedStats({
            db,
            game: updatedGame || { ...game, result: nextResult },
          })
          statsUpdated = true

          await updateParticipantsRatings({
            db,
            game: updatedGame || { ...game, result: nextResult },
            updateAllEntities: true,
          })
          ratingUpdated = true
        }
      } catch (rebuildError) {
        if (rebuildError?.code !== 'RESULT_SNAPSHOTS_MISSING') {
          throw rebuildError
        }
      }
    } else if (snapshotGameTeams.length > 0) {
      await GamesModel.findByIdAndUpdate(normalizedResolvedGameId, {
        $set: { 'result.gameTeams': snapshotGameTeams },
      })
      resultUpdated = true
    }

    const updatedGameForHistory = await GamesModel.findById(
      normalizedResolvedGameId,
    ).lean()
    const afterHistoryState = await fetchGameHistoryState({
      db,
      gameId: normalizedResolvedGameId,
      game: updatedGameForHistory,
    })
    await recordGameHistoryEntry({
      db,
      gameId: normalizedResolvedGameId,
      location: normalizeLocation(game?.location),
      actionType: 'team_out_of_competition_changed',
      entityScope: 'game_teams',
      actor: buildHistoryActorFromSession(session),
      beforeState: beforeHistoryState,
      afterState: afterHistoryState,
      snapshot: buildGameHistorySnapshot(afterHistoryState),
      context: {
        summary: outOfCompetition
          ? 'Команда переведена во вне зачёта'
          : 'Команда возвращена в зачёт',
      },
    })

    return NextResponse.json(
      {
        success: true,
        data: {
          gameId: normalizedResolvedGameId,
          gameTeamId,
          teamId: toStringId(currentGameTeam?.teamId) || '',
          outOfCompetition,
          resultUpdated,
          ratingUpdated,
          statsUpdated,
        },
      },
      { status: 200 },
    )
  } catch (error) {
    console.error(
      'Failed to update out-of-competition flag for game team',
      error,
    )
    return NextResponse.json(
      { success: false, error: 'Не удалось обновить флаг «Вне зачёта»' },
      { status: 500 },
    )
  }
}
