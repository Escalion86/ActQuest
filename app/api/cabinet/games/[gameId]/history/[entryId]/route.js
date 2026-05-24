import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import dbConnectGlobal from '@utils/dbConnectGlobal'
import { toStringId } from '@helpers/idAndDate'
import { canManageGameHistory } from '@server/gameHistory/gameManageAccess'
import sanitizeGameHistoryDisplayState from '@server/gameHistory/sanitizeGameHistoryDisplayState'
import buildGameHistoryDiff from '@server/gameHistory/buildGameHistoryDiff'

const normalizeRole = (value) =>
  typeof value === 'string' ? value.trim().toLowerCase() : ''

export async function GET(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: 'Необходима авторизация' },
      { status: 401 },
    )
  }

  const resolvedParams = await params
  const gameId = toStringId(resolvedParams?.gameId)
  const entryId = toStringId(resolvedParams?.entryId)
  if (!gameId || !entryId) {
    return NextResponse.json(
      { success: false, error: 'Не передан идентификатор игры или записи' },
      { status: 400 },
    )
  }

  try {
    const db = await dbConnectGlobal()
    if (!db) {
      throw new Error('Не удалось подключиться к базе данных')
    }

    const Games = db.model('Games')
    const GameHistoryEntries = db.model('GameHistoryEntries')
    const game = await Games.findById(gameId)
      .select({ _id: 1, creatorUserId: 1, creatorTelegramId: 1, moderators: 1 })
      .lean()

    if (!game?._id) {
      return NextResponse.json(
        { success: false, error: 'Игра не найдена' },
        { status: 404 },
      )
    }

    if (!canManageGameHistory({ session, game })) {
      return NextResponse.json(
        { success: false, error: 'Недостаточно прав' },
        { status: 403 },
      )
    }

    const doc = await GameHistoryEntries.findOne({ _id: entryId, gameId }).lean()
    if (!doc?._id) {
      return NextResponse.json(
        { success: false, error: 'Запись истории не найдена' },
        { status: 404 },
      )
    }

    const latestEntry = await GameHistoryEntries.findOne({ gameId })
      .sort({ createdAt: -1, _id: -1 })
      .select({ _id: 1 })
      .lean()
    const isLatestEntry =
      toStringId(latestEntry?._id) !== '' &&
      toStringId(latestEntry?._id) === toStringId(doc?._id)

    const displayBefore = sanitizeGameHistoryDisplayState(doc?.before ?? null)
    const displayAfter = sanitizeGameHistoryDisplayState(doc?.after ?? null)
    const isDeveloper = normalizeRole(session?.user?.role) === 'dev'

    return NextResponse.json(
      {
        success: true,
        data: {
          id: toStringId(doc?._id) || '',
          actionType: typeof doc?.actionType === 'string' ? doc.actionType : '',
          entityScope:
            typeof doc?.entityScope === 'string' ? doc.entityScope : 'mixed',
          summary: typeof doc?.summary === 'string' ? doc.summary : '',
          actor: doc?.actor && typeof doc.actor === 'object' ? doc.actor : {},
          warnings: Array.isArray(doc?.warnings) ? doc.warnings : [],
          createdAt: doc?.createdAt ? new Date(doc.createdAt).toISOString() : null,
          canRollback: Boolean(doc?.snapshot) && !isLatestEntry,
          before: isDeveloper ? displayBefore : null,
          after: isDeveloper ? displayAfter : null,
          diff: buildGameHistoryDiff({
            before: displayBefore,
            after: displayAfter,
          }),
          rollback: doc?.rollback ?? null,
        },
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('Failed to load game history entry', { error, gameId, entryId })
    return NextResponse.json(
      { success: false, error: 'Не удалось загрузить запись истории' },
      { status: 500 },
    )
  }
}
