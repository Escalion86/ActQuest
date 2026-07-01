import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import {
  isPrequelOpenForDate,
  isPrequelReadyForPlayers,
} from '@helpers/normalizePrequel'
import applyPrequelSubmission from '@server/applyPrequelSubmission'
import normalizePrequelProgressForApi from '@server/normalizePrequelProgress'
import dbConnectGlobal from '@utils/dbConnectGlobal'

const normalizeStringId = (value) =>
  value === null || value === undefined ? '' : String(value).trim()

const resolveCurrentUserId = (session) =>
  session?.user?.globalUserId ||
  session?.user?.userId ||
  session?.user?._id ||
  session?.user?.id ||
  null

export async function POST(request) {
  const session = await getServerSession(authOptions)
  const currentUserId = resolveCurrentUserId(session)
  const currentTelegramId = session?.user?.telegramId || session?.user?.id || null

  if (!currentUserId && !currentTelegramId) {
    return NextResponse.json(
      { success: false, error: 'Необходимо войти в аккаунт' },
      { status: 401 },
    )
  }

  const body = await request.json().catch(() => ({}))
  const payload = body?.data && typeof body.data === 'object' ? body.data : body
  const gameTeamId =
    typeof payload?.gameTeamId === 'string' ? payload.gameTeamId.trim() : ''
  const code = typeof payload?.code === 'string' ? payload.code : ''

  if (!gameTeamId) {
    return NextResponse.json(
      { success: false, error: 'Не указан gameTeamId' },
      { status: 400 },
    )
  }

  try {
    const db = await dbConnectGlobal()
    if (!db) {
      return NextResponse.json(
        { success: false, error: 'База данных недоступна' },
        { status: 503 },
      )
    }

    const GamesTeams = db.model('GamesTeams')
    const gameTeam = await GamesTeams.findById(gameTeamId).lean()
    if (!gameTeam) {
      return NextResponse.json(
        { success: false, error: 'Команда игры не найдена' },
        { status: 404 },
      )
    }

    const teamId = String(gameTeam.teamId || '').trim()
    const memberships = await db
      .model('TeamsUsers')
      .find({ teamId })
      .select({ role: 1, userId: 1, userTelegramId: 1 })
      .lean()
    const matchedMemberships = memberships.filter(
      (membership) =>
        normalizeStringId(membership?.userId) === normalizeStringId(currentUserId) ||
        normalizeStringId(membership?.userTelegramId) ===
          normalizeStringId(currentTelegramId),
    )

    if (
      matchedMemberships.length === 0 ||
      !matchedMemberships.some(
        (membership) =>
          String(membership.role || '').trim().toLowerCase() === 'captain',
      )
    ) {
      return NextResponse.json(
        { success: false, error: 'Отправлять коды приквела может только капитан команды' },
        { status: 403 },
      )
    }

    const game = await db.model('Games').findById(gameTeam.gameId).lean()
    if (!game) {
      return NextResponse.json(
        { success: false, error: 'Игра не найдена' },
        { status: 404 },
      )
    }

    if (game?.dateStartFact || ['started', 'finished', 'closed'].includes(String(game?.status || '').toLowerCase())) {
      return NextResponse.json(
        { success: false, error: 'После фактического старта игры приквел недоступен' },
        { status: 409 },
      )
    }

    if (!isPrequelReadyForPlayers(game?.prequel)) {
      return NextResponse.json(
        { success: false, error: 'Приквел заполнен не полностью' },
        { status: 400 },
      )
    }

    if (!isPrequelOpenForDate(game?.prequel, new Date())) {
      return NextResponse.json(
        { success: false, error: 'Приквел ещё не открыт' },
        { status: 423 },
      )
    }

    const result = applyPrequelSubmission({
      game,
      gameTeam,
      code,
      now: new Date(),
    })

    if (!result.ok) {
      return NextResponse.json(
        {
          success: false,
          error: result.message,
          progress: normalizePrequelProgressForApi(result.progress),
        },
        { status: result.status || 400 },
      )
    }

    await GamesTeams.findByIdAndUpdate(gameTeamId, {
      $set: { prequelProgress: result.progress },
    })

    return NextResponse.json({
      success: true,
      message: result.message,
      matchedCategory: result.matchedCategory,
      progress: normalizePrequelProgressForApi(result.progress),
    })
  } catch (error) {
    console.error('Failed to submit prequel code', error)
    return NextResponse.json(
      { success: false, error: 'Не удалось обработать код приквела' },
      { status: 500 },
    )
  }
}
