import { NextResponse } from 'next/server'

import { proxyToLocationGameRoute } from '@app/api/cabinet/_lib/proxyToLocationGameRoute'

const execute = async (request, { params }) => {
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
    method: request.method === 'POST' ? 'POST' : 'GET',
  })
}


export async function GET(request, context) {
  return execute(request, context)
}

export async function POST(request, context) {
  return execute(request, context)
}
