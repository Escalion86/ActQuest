import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@server/auth/authOptions'
import { normalizeRole } from '@server/gameHistory/gameManageAccess'
import { GameStageError } from '@server/buildGameStageResult'
import updateParticipantsRatings from '@server/updateParticipantsRatings'
import dbConnectGlobal from '@utils/dbConnectGlobal'

export const withStageRequest = async (request, action) => {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Необходима авторизация.' }, { status: 401 })
  }
  if (!['admin', 'dev'].includes(normalizeRole(session.user.role))) {
    return NextResponse.json({ success: false, error: 'Недостаточно прав для управления общим зачётом.' }, { status: 403 })
  }

  try {
    const [db, body] = await Promise.all([dbConnectGlobal(), request.json().catch(() => null)])
    if (!body || typeof body !== 'object') throw new GameStageError('Отправьте параметры действия.', 400)
    if (!db) throw new Error('Нет подключения к базе данных')
    return await action({ db, body, session })
  } catch (error) {
    if (error instanceof GameStageError || error?.registrationStatus) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status ?? error.registrationStatus })
    }
    console.error('Ошибка операции с общим зачётом', error)
    return NextResponse.json({ success: false, error: 'Не удалось выполнить операцию с общим зачётом.' }, { status: 500 })
  }
}

export const recalculateStageRatings = async (db, { published, affectedGames }) => {
  if (published.isRated !== false) {
    await updateParticipantsRatings({ db, game: published, affectedGames, updateAllEntities: true })
  }
  return { stageId: String(published._id) }
}
