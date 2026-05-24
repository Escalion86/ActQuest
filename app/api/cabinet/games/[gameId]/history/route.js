import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import dbConnectGlobal from '@utils/dbConnectGlobal'
import { toStringId } from '@helpers/idAndDate'
import { canManageGameHistory } from '@server/gameHistory/gameManageAccess'

const mapHistoryListItem = (doc, options = {}) => ({
  id: toStringId(doc?._id) || '',
  actionType: typeof doc?.actionType === 'string' ? doc.actionType : '',
  entityScope: typeof doc?.entityScope === 'string' ? doc.entityScope : 'mixed',
  summary: typeof doc?.summary === 'string' ? doc.summary : '',
  actor: doc?.actor && typeof doc.actor === 'object' ? doc.actor : {},
  warnings: Array.isArray(doc?.warnings) ? doc.warnings : [],
  createdAt: doc?.createdAt ? new Date(doc.createdAt).toISOString() : null,
  canRollback: Boolean(doc?.snapshot) && !options?.isLatestEntry,
})

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
  if (!gameId) {
    return NextResponse.json(
      { success: false, error: 'Не передан идентификатор игры' },
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

    const docs = await GameHistoryEntries.find({ gameId })
      .sort({ createdAt: -1, _id: -1 })
      .lean()

    return NextResponse.json(
      {
        success: true,
        data: Array.isArray(docs)
          ? docs.map((doc, index) =>
              mapHistoryListItem(doc, { isLatestEntry: index === 0 }),
            )
          : [],
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('Failed to load game history list', { error, gameId })
    return NextResponse.json(
      { success: false, error: 'Не удалось загрузить историю игры' },
      { status: 500 },
    )
  }
}
