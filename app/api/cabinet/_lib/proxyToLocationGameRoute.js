import { NextResponse } from 'next/server'

import { resolveGameLocationById } from '@app/api/cabinet/_lib/resolveGameLocation'
import * as gameRouteHandlers from '@app/api/[location]/games/[id]/route'
import * as gameCheckRouteHandlers from '@app/api/[location]/games/check/[id]/route'
import * as gameStartRouteHandlers from '@app/api/[location]/games/start/[id]/route'
import * as gameStopRouteHandlers from '@app/api/[location]/games/stop/[id]/route'

const copyContentType = (sourceHeaders) => {
  const value =
    sourceHeaders?.get?.('content-type') ||
    sourceHeaders?.get?.('Content-Type') ||
    'application/json'
  return value
}

const toUpperMethod = (method) => String(method || 'GET').trim().toUpperCase()

const resolveHandlerModuleByTargetPath = (targetPath) => {
  const normalizedPath = String(targetPath || '')
  if (normalizedPath === '/api/:location/games/:gameId') {
    return gameRouteHandlers
  }
  if (normalizedPath === '/api/:location/games/check/:gameId') {
    return gameCheckRouteHandlers
  }
  if (normalizedPath === '/api/:location/games/start/:gameId') {
    return gameStartRouteHandlers
  }
  if (normalizedPath === '/api/:location/games/stop/:gameId') {
    return gameStopRouteHandlers
  }

  return null
}

const invokeLocationRouteInProcess = async ({
  targetPath,
  method,
  targetUrl,
  headers,
  bodyText,
  location,
  gameId,
}) => {
  const moduleHandlers = resolveHandlerModuleByTargetPath(targetPath)
  if (!moduleHandlers) {
    throw new Error(`Неизвестный location-route targetPath: ${String(targetPath || '')}`)
  }

  const methodKey = toUpperMethod(method)
  const routeHandler = moduleHandlers?.[methodKey]
  if (typeof routeHandler !== 'function') {
    throw new Error(`Метод ${methodKey} не поддерживается targetPath ${String(targetPath || '')}`)
  }

  const internalRequest = new Request(targetUrl.toString(), {
    method: methodKey,
    headers,
    body: bodyText,
    cache: 'no-store',
  })

  return routeHandler(internalRequest, {
    params: Promise.resolve({
      location,
      id: gameId,
    }),
  })
}

export const proxyToLocationGameRoute = async ({
  request,
  gameId,
  targetPath,
  method = 'GET',
  bodyText = null,
}) => {
  try {
    const resolved = await resolveGameLocationById(gameId)
    if (resolved.error || !resolved.location || !resolved.gameId) {
      return NextResponse.json(
        { success: false, error: resolved.error || 'Не удалось определить площадку игры' },
        { status: resolved.status || 400 },
      )
    }

    const resolvedTargetPath = String(targetPath || '')
      .replaceAll(':location', encodeURIComponent(resolved.location))
      .replaceAll(':gameId', encodeURIComponent(resolved.gameId))

    const targetUrl = new URL(resolvedTargetPath, request.nextUrl.origin)

    const headers = new Headers()
    headers.set('content-type', copyContentType(request.headers))
    const cookie = request.headers.get('cookie')
    if (cookie) {
      headers.set('cookie', cookie)
    }

    try {
      const response = await fetch(targetUrl, {
        method,
        headers,
        body: bodyText,
        cache: 'no-store',
      })

      const contentType = response.headers.get('content-type') || 'application/json'
      const payload = await response.text()

      return new NextResponse(payload, {
        status: response.status,
        headers: { 'content-type': contentType },
      })
    } catch (fetchError) {
      console.error('[cabinet-games-proxy] internal fetch failed, fallback to in-process route', {
        targetPath,
        method: toUpperMethod(method),
        message: fetchError?.message || String(fetchError),
      })

      const fallbackResponse = await invokeLocationRouteInProcess({
        targetPath,
        method,
        targetUrl,
        headers,
        bodyText,
        location: resolved.location,
        gameId: resolved.gameId,
      })

      if (fallbackResponse instanceof Response) {
        return fallbackResponse
      }

      return NextResponse.json(
        {
          success: false,
          error: 'Fallback route вернул некорректный ответ',
        },
        { status: 500 },
      )
    }
  } catch (error) {
    console.error('[cabinet-games-proxy] proxy failed', {
      targetPath,
      method: toUpperMethod(method),
      message: error?.message || String(error),
    })

    const message =
      typeof error?.message === 'string' && error.message.trim()
        ? error.message.trim()
        : 'Не удалось выполнить прокси-запрос к маршруту игры'

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    )
  }
}
