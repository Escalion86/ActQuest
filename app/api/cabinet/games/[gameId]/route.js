import { NextResponse } from 'next/server'

import { proxyToLocationGameRoute } from '@app/api/cabinet/_lib/proxyToLocationGameRoute'

export async function PUT(request, { params }) {
  const resolvedParams = await params
  const gameId = resolvedParams?.gameId
  if (!gameId) {
    return NextResponse.json(
      { success: false, error: 'Не передан идентификатор игры' },
      { status: 400 },
    )
  }
  const bodyText = await request.text()

  return proxyToLocationGameRoute({
    request,
    gameId,
    targetPath: '/api/:location/games/:gameId',
    method: 'PUT',
    bodyText,
  })
}
