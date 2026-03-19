import dbConnectGlobal from '@utils/dbConnectGlobal'
import buildGameResultComputed from '@server/buildGameResultComputed'

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

const resolveLocation = (req) => {
  const queryLocation = typeof req.query?.location === 'string' ? req.query.location : null
  const bodyLocation = typeof req.body?.location === 'string' ? req.body.location : null
  return bodyLocation || queryLocation || null
}

const resolveInteractiveResultsUrl = ({ gameId, game, result }) => {
  const explicitUrlCandidates = [
    result?.interactiveTableUrl,
    result?.interactiveResultsUrl,
    result?.tableUrl,
  ]
  const explicitUrl = explicitUrlCandidates.find(
    (candidate) => typeof candidate === 'string' && candidate.trim().length > 0
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

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', ['GET', 'POST'])
    return res.status(405).json({ success: false, error: 'Метод не поддерживается' })
  }

  const { gameId } = req.query
  const location = resolveLocation(req)
  const normalizedGameId = toStringId(gameId)

  if (!normalizedGameId) {
    return res.status(400).json({ success: false, error: 'Не передан идентификатор игры' })
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
      return res.status(404).json({ success: false, error: 'Игра не найдена' })
    }

    const gameLocation =
      typeof game.location === 'string' ? game.location.trim().toLowerCase() : null
    const requestedLocation =
      typeof location === 'string' ? location.trim().toLowerCase() : null

    if (gameLocation && requestedLocation && gameLocation !== requestedLocation) {
      return res
        .status(403)
        .json({ success: false, error: 'Игра недоступна для выбранной площадки' })
    }

    const status = typeof game.status === 'string' ? game.status.toLowerCase() : ''
    if (status !== 'finished' && status !== 'closed') {
      return res.status(403).json({
        success: false,
        error: 'Результаты доступны только для завершённых или закрытых игр',
      })
    }

    if (req.method === 'GET' && Boolean(game.hideResult)) {
      return res.status(403).json({
        success: false,
        error: 'Просмотр результатов отключён в настройках игры',
      })
    }

    if (req.method === 'POST') {
      let built = null
      try {
        built = await buildGameResultComputed({ game })
      } catch (buildError) {
        if (buildError?.code === 'RESULT_SNAPSHOTS_MISSING') {
          return res.status(409).json({
            success: false,
            error:
              'Нет сохранённого снимка результатов. Остановите игру, чтобы сохранить snapshot, затем повторите формирование.',
          })
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
        { new: true, runValidators: true }
      ).lean()

      const updatedResult =
        updatedGame?.result && typeof updatedGame.result === 'object'
          ? updatedGame.result
          : nextResult
      const rows = buildRows(updatedResult)

      return res.status(200).json({
        success: true,
        data: buildResponseData({
          gameId: normalizedGameId,
          game: updatedGame || game,
          result: updatedResult,
          rows,
        }),
      })
    }

    const result = game.result && typeof game.result === 'object' ? game.result : {}
    const rows = buildRows(result)

    return res.status(200).json({
      success: true,
      data: buildResponseData({ gameId: normalizedGameId, game, result, rows }),
    })
  } catch (error) {
    console.error('Failed to load game result for cabinet', error)
    return res.status(500).json({ success: false, error: 'Не удалось загрузить результаты игры' })
  }
}
