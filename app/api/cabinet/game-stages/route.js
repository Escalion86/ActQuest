import { NextResponse } from 'next/server'
import { combineClosedGames } from '@server/gameStages'
import { recalculateStageRatings, withStageRequest } from './_lib/stageRequest'

export async function POST(request) {
  return withStageRequest(request, async ({ db, body, session }) => {
    const preview = body.preview !== false
    const result = await combineClosedGames({ db, session, gameIds: body.gameIds, preview })
    const data = preview ? result : await recalculateStageRatings(db, result)
    return NextResponse.json({ success: true, data }, { status: 200 })
  })
}
