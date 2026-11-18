import { NextResponse } from 'next/server'
import { GameStageError } from '@server/buildGameStageResult'
import { isGameStageId, publishGameStage } from '@server/gameStages'
import { recalculateStageRatings, withStageRequest } from '../_lib/stageRequest'

export async function POST(request, { params }) {
  return withStageRequest(request, async ({ db, body, session }) => {
    const { id } = await params
    if (!isGameStageId(id)) throw new GameStageError('Укажите этап.', 400)
    if (body.action !== 'publish') throw new GameStageError('Неизвестное действие.', 400)
    const published = await publishGameStage({ db, session, stageId: id })
    const data = await recalculateStageRatings(db, published)
    return NextResponse.json({ success: true, data }, { status: 200 })
  })
}
