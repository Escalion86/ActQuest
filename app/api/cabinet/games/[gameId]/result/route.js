import { NextResponse } from 'next/server'

import dbConnectGlobal from '@utils/dbConnectGlobal'
import buildGameResultComputed from '@server/buildGameResultComputed'
import updateParticipantsRatings from '@server/updateParticipantsRatings'

const toStringId = (value) => {
  if (value === null || value === undefined) {
    return null
  }

  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }

  if (typeof value.toString === 'function') {
    const stringValue = value.toString()
    return stringValue && stringValue !== '[object Object]' ? stringValue : null
  }

  return null
}

const normalizeTeamsPlaces = (teamsPlaces) => {
  if (!teamsPlaces) {
    return {}
  }

  if (typeof teamsPlaces.get === 'function') {
    return Array.from(teamsPlaces.entries()).reduce((acc, [teamId, place]) => {
      const normalizedTeamId = toStringId(teamId)
      const numericPlace = Number(place)
      if (normalizedTeamId && Number.isFinite(numericPlace)) {
        acc[normalizedTeamId] = numericPlace
      }
      return acc
    }, {})
  }

  if (typeof teamsPlaces === 'object') {
    return Object.entries(teamsPlaces).reduce((acc, [teamId, place]) => {
      const normalizedTeamId = toStringId(teamId)
      const numericPlace = Number(place)
      if (normalizedTeamId && Number.isFinite(numericPlace)) {
        acc[normalizedTeamId] = numericPlace
      }
      return acc
    }, {})
  }

  return {}
}

const buildRows = (result) => {
  const teams = Array.isArray(result?.teams) ? result.teams : []
  const teamsPlaces = normalizeTeamsPlaces(result?.teamsPlaces)

  const rows = teams.map((team) => {
    const teamId = toStringId(team?._id ?? team?.id)
    const teamName =
      typeof team?.name === 'string' && team.name.trim().length > 0
        ? team.name.trim()
        : 'Без названия'
    const placeRaw = teamId ? teamsPlaces[teamId] : null
    const place = Number.isFinite(Number(placeRaw)) ? Number(placeRaw) : null

    return {
      teamId: teamId || '',
      teamName,
      place,
    }
  })

  return rows.sort((a, b) => {
    const aPlace = Number.isFinite(a.place) ? a.place : Number.MAX_SAFE_INTEGER
    const bPlace = Number.isFinite(b.place) ? b.place : Number.MAX_SAFE_INTEGER

    if (aPlace !== bPlace) {
      return aPlace - bPlace
    }

    return a.teamName.localeCompare(b.teamName, 'ru')
  })
}

const resolveInteractiveResultsUrl = ({ gameId, game, result }) => {
  const explicitUrlCandidates = [
    result?.interactiveTableUrl,
    result?.interactiveResultsUrl,
    result?.tableUrl,
  ]
  const explicitUrl = explicitUrlCandidates.find(
    (candidate) => typeof candidate === 'string' && candidate.trim().length > 0,
  )
  if (explicitUrl) {
    return explicitUrl.trim()
  }

  const gameLocation =
    typeof game?.location === 'string' ? game.location.trim().toLowerCase() : ''
  if (!gameLocation) {
    return null
  }

  return `/${gameLocation}/game/result/${encodeURIComponent(gameId)}`
}

const buildResponseData = ({ gameId, game, result, rows }) => {
  const safeGameName =
    typeof game.name === 'string' && game.name.trim().length > 0
      ? game.name.trim()
      : 'Без названия'

  return {
    gameId,
    gameName: safeGameName,
    rows,
    teamsCount: rows.length,
    participantsCount: Array.isArray(result?.teamsUsers) ? result.teamsUsers.length : 0,
    computed: result?.computed && typeof result.computed === 'object' ? result.computed : null,
    interactiveResultsUrl: resolveInteractiveResultsUrl({ gameId, game, result }),
  }
}

const handleRequest = async ({ request, params, method }) => {
  const requestUrl = new URL(request.url)
  const { gameId } = params
  const normalizedGameId = toStringId(gameId)
  const queryLocation =
    typeof requestUrl.searchParams.get('location') === 'string'
      ? requestUrl.searchParams.get('location')
      : null

  const payload =
    method === 'POST' ? await request.json().catch(() => ({})) : {}
  const bodyLocation =
    typeof payload?.location === 'string' ? payload.location : null
  const location = bodyLocation || queryLocation || null

  if (!normalizedGameId) {
    return NextResponse.json(
      { success: false, error: 'Не передан идентификатор игры' },
      { status: 400 },
    )
  }

  try {
    const db = await dbConnectGlobal()

    if (!db) {
      throw new Error('Соединение с базой данных не установлено')
    }

    const game = await db
      .model('Games')
      .findById(normalizedGameId)
      .select({
        _id: 1,
        name: 1,
        location: 1,
        status: 1,
        hideResult: 1,
        dateStartFact: 1,
        dateEndFact: 1,
        taskDuration: 1,
        taskFailurePenalty: 1,
        manyCodesPenalty: 1,
        tasks: 1,
        result: 1,
      })
      .lean()

    if (!game) {
      return NextResponse.json(
        { success: false, error: 'Игра не найдена' },
        { status: 404 },
      )
    }

    const gameLocation =
      typeof game.location === 'string' ? game.location.trim().toLowerCase() : null
    const requestedLocation =
      typeof location === 'string' ? location.trim().toLowerCase() : null

    if (gameLocation && requestedLocation && gameLocation !== requestedLocation) {
      return NextResponse.json(
        { success: false, error: 'Игра недоступна для выбранной площадки' },
        { status: 403 },
      )
    }

    const status = typeof game.status === 'string' ? game.status.toLowerCase() : ''
    if (status !== 'finished' && status !== 'closed') {
      return NextResponse.json(
        {
          success: false,
          error: 'Результаты доступны только для завершённых или закрытых игр',
        },
        { status: 403 },
      )
    }

    if (method === 'GET' && Boolean(game.hideResult)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Просмотр результатов отключён в настройках игры',
        },
        { status: 403 },
      )
    }

    if (method === 'POST') {
      let built = null
      try {
        built = await buildGameResultComputed({ game })
      } catch (buildError) {
        if (buildError?.code === 'RESULT_SNAPSHOTS_MISSING') {
          return NextResponse.json(
            {
              success: false,
              error:
                'Нет сохранённого снимка результатов. Остановите игру, чтобы сохранить snapshot, затем повторите формирование.',
            },
            { status: 409 },
          )
        }
        throw buildError
      }

      const nextResult = {
        ...(game.result && typeof game.result === 'object' ? game.result : {}),
        teamsPlaces: built.teamsPlaces,
        computed: built.computed,
      }

      const updatedGame = await db.model('Games').findByIdAndUpdate(
        normalizedGameId,
        { result: nextResult },
        { new: true, runValidators: true },
      ).lean()

      let ratingsUpdateInfo = {
        usersUpdated: 0,
        teamsUpdated: 0,
      }

      try {
        ratingsUpdateInfo = await updateParticipantsRatings({
          db,
          game: updatedGame || { ...game, result: nextResult },
        })
      } catch (ratingError) {
        console.error('Failed to update players/teams ratings', ratingError)
      }

      const updatedResult =
        updatedGame?.result && typeof updatedGame.result === 'object'
          ? updatedGame.result
          : nextResult
      const rows = buildRows(updatedResult)

      return NextResponse.json(
        {
          success: true,
          data: buildResponseData({
            gameId: normalizedGameId,
            game: updatedGame || game,
            result: updatedResult,
            rows,
          }),
          ratingUpdate: ratingsUpdateInfo,
        },
        { status: 200 },
      )
    }

    const result = game.result && typeof game.result === 'object' ? game.result : {}
    const rows = buildRows(result)

    return NextResponse.json(
      {
        success: true,
        data: buildResponseData({ gameId: normalizedGameId, game, result, rows }),
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('Failed to load game result for cabinet (app)', error)
    return NextResponse.json(
      { success: false, error: 'Не удалось загрузить результаты игры' },
      { status: 500 },
    )
  }
}

export async function GET(request, context) {
  return handleRequest({ request, params: context.params, method: 'GET' })
}

export async function POST(request, context) {
  return handleRequest({ request, params: context.params, method: 'POST' })
}
