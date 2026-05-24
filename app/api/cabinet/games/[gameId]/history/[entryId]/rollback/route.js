import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import dbConnectGlobal from '@utils/dbConnectGlobal'
import { toStringId } from '@helpers/idAndDate'
import rollbackGameToHistoryEntry from '@server/gameHistory/rollbackGameToHistoryEntry'
import fetchGameHistoryState from '@server/gameHistory/fetchGameHistoryState'
import recordGameHistoryEntry from '@server/gameHistory/recordGameHistoryEntry'
import buildGameHistorySnapshot from '@server/gameHistory/buildGameHistorySnapshot'
import {
  canManageGameHistory,
  buildHistoryActorFromSession,
} from '@server/gameHistory/gameManageAccess'

export async function POST(request, { params }) {
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
      .select({
        _id: 1,
        name: 1,
        status: 1,
        location: 1,
        creatorUserId: 1,
        creatorTelegramId: 1,
        moderators: 1,
      })
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

    const historyEntry = await GameHistoryEntries.findOne({
      _id: entryId,
      gameId,
    }).lean()
    if (!historyEntry?._id) {
      return NextResponse.json(
        { success: false, error: 'Запись истории не найдена' },
        { status: 404 },
      )
    }
    if (!historyEntry?.snapshot) {
      return NextResponse.json(
        { success: false, error: 'Для этой записи rollback недоступен' },
        { status: 409 },
      )
    }

    const latestEntry = await GameHistoryEntries.findOne({ gameId })
      .sort({ createdAt: -1, _id: -1 })
      .select({ _id: 1 })
      .lean()
    if (toStringId(latestEntry?._id) === entryId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Нельзя выполнить откат на последнее действие истории',
        },
        { status: 409 },
      )
    }

    const rolledBackEntriesCount = await GameHistoryEntries.countDocuments({
      gameId,
      createdAt: { $gt: historyEntry.createdAt },
    })

    const rollbackResult = await rollbackGameToHistoryEntry({
      db,
      gameId,
      historyEntry,
      rolledBackEntriesCount,
    })

    const afterHistoryState = await fetchGameHistoryState({
      db,
      gameId,
    })
    const rollbackWarnings = Array.from(
      new Set([
        ...(Array.isArray(rollbackResult?.warnings) ? rollbackResult.warnings : []),
        ...(String(game?.status || '').trim().toLowerCase() === 'started'
          ? [
              'Игра была запущена в момент отката. Проверьте прогресс команд и текущее состояние игры.',
            ]
          : []),
      ]),
    )

    await recordGameHistoryEntry({
      db,
      gameId,
      location:
        typeof game?.location === 'string' ? game.location.trim().toLowerCase() : null,
      actionType: 'rollback_applied',
      entityScope: 'mixed',
      actor: buildHistoryActorFromSession(session),
      beforeState: rollbackResult?.currentState ?? null,
      afterState: afterHistoryState,
      snapshot: buildGameHistorySnapshot(afterHistoryState),
      rollback: {
        rolledBackToEntryId: entryId,
        rolledBackEntriesCount,
      },
      context: {
        summary: `Выполнен откат игры к записи истории от ${historyEntry?.createdAt ? new Date(historyEntry.createdAt).toISOString() : 'unknown time'}`,
        warnings: rollbackWarnings,
      },
    })

    return NextResponse.json(
      {
        success: true,
        data: {
          rolledBackToEntryId: entryId,
          rolledBackEntriesCount,
          warnings: rollbackWarnings,
        },
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('Failed to rollback game history entry', { error, gameId, entryId })
    return NextResponse.json(
      { success: false, error: 'Не удалось выполнить откат истории игры' },
      { status: 500 },
    )
  }
}
