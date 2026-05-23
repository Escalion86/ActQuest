import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import dbConnectGlobal from '@utils/dbConnectGlobal'
import { toStringId } from '@helpers/idAndDate'
import {
  fetchGameTeamDialogSummaries,
  isGameManager,
} from '@server/gameTeamMessages'

const getGameForMessages = (db, gameId) =>
  db
    .model('Games')
    .findById(gameId)
    .select({
      _id: 1,
      name: 1,
      creatorUserId: 1,
      creatorTelegramId: 1,
      moderators: 1,
    })
    .lean()

export async function GET(_request, { params }) {
  const session = await getServerSession(authOptions)
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
      return NextResponse.json(
        { success: false, error: 'База данных недоступна' },
        { status: 503 },
      )
    }

    const game = await getGameForMessages(db, gameId)
    if (!game) {
      return NextResponse.json(
        { success: false, error: 'Игра не найдена' },
        { status: 404 },
      )
    }

    if (!isGameManager({ sessionUser: session.user, game })) {
      return NextResponse.json(
        { success: false, error: 'Недостаточно прав' },
        { status: 403 },
      )
    }

    const dialogs = await fetchGameTeamDialogSummaries({ db, gameId })
    return NextResponse.json({ success: true, data: { dialogs } })
  } catch (error) {
    console.error('Failed to fetch game team dialogs', error)
    return NextResponse.json(
      { success: false, error: 'Не удалось загрузить диалоги команд' },
      { status: 500 },
    )
  }
}
