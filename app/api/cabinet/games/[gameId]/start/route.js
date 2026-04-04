import { NextResponse } from 'next/server'

import { proxyToLocationGameRoute } from '@app/api/cabinet/_lib/proxyToLocationGameRoute'

export async function GET(request, { params }) {
  const resolvedParams = await params
  const gameId = resolvedParams?.gameId
  if (!gameId) {
    return NextResponse.json(
      { success: false, error: 'Не передан идентификатор игры' },
      { status: 400 },
    )
  }

  return proxyToLocationGameRoute({
    request,
    gameId,
    targetPath: '/api/:location/games/start/:gameId',
    method: 'GET',
  })
}
