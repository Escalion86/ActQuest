import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import applyPrequelSubmission from '@server/applyPrequelSubmission'
import applyPrequelStoryEffects from '@server/applyPrequelStoryEffects'
import {
  getGamePrequels,
  getGameTeamPrequelProgresses,
} from '@helpers/normalizePrequel'
import { resolveSessionIdentity } from '@server/gameHistory/gameManageAccess'
import { toStringId } from '@helpers/idAndDate'
import dbConnectGlobal from '@utils/dbConnectGlobal'

const isObjectIdLike = (value) => /^[0-9a-fA-F]{24}$/.test(String(value || ''))

const findGame = async (Games, gameId) => {
  if (isObjectIdLike(gameId)) {
    const byId = await Games.findById(gameId).lean()
    if (byId) return byId
  }
  return Games.findOne({ id: String(gameId || '') }).lean()
}

const canManagePrequels = ({ session, game }) => {
  const identity = resolveSessionIdentity(session)
  if (identity.role === 'admin' || identity.role === 'dev') return true
  if (identity.role !== 'moder' || !identity.userId) return false
  return (Array.isArray(game?.moderators) ? game.moderators : []).some(
    (item) => toStringId(item?._id ?? item?.id ?? item) === identity.userId,
  )
}

const loadContext = async ({ params, session }) => {
  const resolvedParams = await params
  const gameId = toStringId(resolvedParams?.gameId)
  const gameTeamId = toStringId(resolvedParams?.gameTeamId)
  if (!gameId || !gameTeamId) {
    return { response: NextResponse.json({ success: false, error: 'Не переданы идентификаторы' }, { status: 400 }) }
  }

  const db = await dbConnectGlobal()
  if (!db) {
    return { response: NextResponse.json({ success: false, error: 'База данных недоступна' }, { status: 503 }) }
  }
  const game = await findGame(db.model('Games'), gameId)
  if (!game) {
    return { response: NextResponse.json({ success: false, error: 'Игра не найдена' }, { status: 404 }) }
  }
  if (!canManagePrequels({ session, game })) {
    return { response: NextResponse.json({ success: false, error: 'Недостаточно прав' }, { status: 403 }) }
  }

  const gameTeam = await db.model('GamesTeams').findOne({
    _id: gameTeamId,
    gameId: toStringId(game._id),
  }).lean()
  if (!gameTeam) {
    return { response: NextResponse.json({ success: false, error: 'Команда игры не найдена' }, { status: 404 }) }
  }
  return { db, game, gameTeam, gameTeamId }
}

export async function GET(_request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Требуется авторизация' }, { status: 401 })
  }

  const context = await loadContext({ params, session })
  if (context.response) return context.response
  const prequels = getGamePrequels(context.game)
  const progresses = getGameTeamPrequelProgresses(context.gameTeam, prequels)
  return NextResponse.json({ success: true, data: { prequels, progresses } })
}

export async function POST(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Требуется авторизация' }, { status: 401 })
  }

  const payload = await request.json().catch(() => ({}))
  const context = await loadContext({ params, session })
  if (context.response) return context.response
  const normalizedStatus = String(context.game?.status || '').toLowerCase()
  if (!['active', 'started'].includes(normalizedStatus)) {
    return NextResponse.json(
      { success: false, error: 'Изменять приквел можно только до или во время игры' },
      { status: 409 },
    )
  }

  const action = String(payload?.action || '').trim()
  const prequelId = String(payload?.prequelId || '').trim()
  const identity = resolveSessionIdentity(session)
  const result = applyPrequelSubmission({
    game: context.game,
    gameTeam: context.gameTeam,
    prequelId,
    codeId: action === 'activate_code' ? String(payload?.codeId || '') : '',
    manualComplete: action === 'complete',
    source: 'admin',
    actorUserId: identity.userId,
    bypassAvailability: true,
    now: new Date(),
  })
  if (!['activate_code', 'complete'].includes(action)) {
    return NextResponse.json({ success: false, error: 'Неизвестное действие' }, { status: 400 })
  }
  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.message }, { status: result.status || 400 })
  }

  const prequels = getGamePrequels(context.game)
  const currentProgresses = getGameTeamPrequelProgresses(context.gameTeam, prequels)
  const index = currentProgresses.findIndex((item) => item.prequelId === prequelId)
  const nextProgresses = [...currentProgresses]
  if (index >= 0) nextProgresses[index] = result.progress
  else nextProgresses.push(result.progress)

  const oldEffectIds = new Set(
    (index >= 0 && Array.isArray(currentProgresses[index]?.appliedStoryEffects)
      ? currentProgresses[index].appliedStoryEffects
      : []).map(
      (item) => item.id,
    ),
  )
  const newEffects = result.progress.appliedStoryEffects.filter(
    (item) => !oldEffectIds.has(item.id),
  )
  let storyProgress = context.gameTeam.storyProgress
  if (
    context.game.type === 'story' &&
    normalizedStatus === 'started' &&
    newEffects.length > 0
  ) {
    storyProgress = applyPrequelStoryEffects({
      game: context.game,
      progress: storyProgress,
      effects: newEffects,
      now: new Date(),
      sourceLabel: 'административное действие по приквелу',
    }).progress
  }

  await context.db.model('GamesTeams').updateOne(
    { _id: context.gameTeamId },
    { $set: { prequelProgresses: nextProgresses, ...(storyProgress ? { storyProgress } : {}) } },
  )

  return NextResponse.json({
    success: true,
    message: result.message,
    data: { prequelId, progress: result.progress },
  })
}
