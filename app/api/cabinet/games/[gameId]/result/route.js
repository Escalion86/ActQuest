import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import dbConnectGlobal from '@utils/dbConnectGlobal'
import buildGameResultComputed from '@server/buildGameResultComputed'
// import buildGameResultSnapshots from '@server/buildGameResultSnapshots'
import updateParticipantsRatings from '@server/updateParticipantsRatings'
import fetchGameHistoryState from '@server/gameHistory/fetchGameHistoryState'
import recordGameHistoryEntry from '@server/gameHistory/recordGameHistoryEntry'
import buildGameHistorySnapshot from '@server/gameHistory/buildGameHistorySnapshot'
import { authOptions } from '@server/auth/authOptions'
import { toStringId } from '@helpers/idAndDate'

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

const hasResultSnapshots = (result) =>
  Array.isArray(result?.teams) &&
  result.teams.length > 0 &&
  Array.isArray(result?.gameTeams) &&
  result.gameTeams.length > 0 &&
  Array.isArray(result?.teamsUsers) &&
  result.teamsUsers.length > 0

const hasComputedResult = (result) =>
  result?.computed && typeof result.computed === 'object'

const normalizeSessionIdentity = (session) => {
  const sessionUser = session?.user ?? {}
  const userId = toStringId(
    sessionUser.globalUserId ??
      sessionUser.userId ??
      sessionUser._id ??
      sessionUser.id ??
      null,
  )
  const userTelegramId =
    sessionUser.telegramId !== null && sessionUser.telegramId !== undefined
      ? String(sessionUser.telegramId).trim()
      : null

  const normalizeRole = (value) => {
    if (typeof value !== 'string') {
      return 'client'
    }
    const normalized = value.trim().toLowerCase()
    return ['client', 'moder', 'admin', 'dev'].includes(normalized)
      ? normalized
      : 'client'
  }

  return {
    userId,
    userTelegramId,
    role: normalizeRole(sessionUser.role),
  }
}

const isElevatedRole = (role) => role === 'admin' || role === 'dev'

const buildHistoryActorFromSession = (session) => ({
  userId:
    session?.user?.globalUserId ??
    session?.user?.userId ??
    session?.user?._id ??
    session?.user?.id ??
    null,
  telegramId:
    session?.user?.telegramId !== null &&
    session?.user?.telegramId !== undefined
      ? String(session.user.telegramId).trim()
      : null,
  role: typeof session?.user?.role === 'string' ? session.user.role : '',
  name: typeof session?.user?.name === 'string' ? session.user.name : '',
})

const hasGameManageAccess = ({ identity, game }) => {
  if (!identity || !game) {
    return false
  }

  if (isElevatedRole(identity.role)) {
    return true
  }

  const creatorUserId = toStringId(game?.creatorUserId)
  if (identity.userId && creatorUserId && identity.userId === creatorUserId) {
    return true
  }

  const creatorTelegramId =
    game?.creatorTelegramId !== null && game?.creatorTelegramId !== undefined
      ? String(game.creatorTelegramId).trim()
      : ''

  if (identity.userTelegramId && creatorTelegramId) {
    if (identity.userTelegramId === creatorTelegramId) {
      return true
    }
  }

  if (!identity.userId) {
    return false
  }

  const moderators = Array.isArray(game?.moderators) ? game.moderators : []
  return moderators.some((moderator) => {
    if (!moderator) {
      return false
    }

    if (typeof moderator === 'string') {
      return toStringId(moderator) === identity.userId
    }

    return toStringId(moderator?.id ?? moderator?._id) === identity.userId
  })
}

const resolveUserParticipationTeamIds = ({ result, session }) => {
  const identity = normalizeSessionIdentity(session)
  if (!identity.userId && !identity.userTelegramId) {
    return []
  }

  const teamsUsers = Array.isArray(result?.teamsUsers) ? result.teamsUsers : []
  const userId = identity.userId
  const userTelegramId = identity.userTelegramId

  return Array.from(
    new Set(
      teamsUsers
        .filter((membership) => {
          const membershipUserId = toStringId(membership?.userId)
          const membershipTelegramId =
            typeof membership?.userTelegramId === 'number'
              ? String(membership.userTelegramId)
              : typeof membership?.userTelegramId === 'string'
                ? membership.userTelegramId.trim()
                : ''

          if (userId && membershipUserId && membershipUserId === userId) {
            return true
          }

          if (
            userTelegramId &&
            membershipTelegramId &&
            membershipTelegramId === userTelegramId
          ) {
            return true
          }

          return false
        })
        .map((membership) => toStringId(membership?.teamId))
        .filter(Boolean),
    ),
  )
}

const buildRows = ({ result, includeTeamIds = [] }) => {
  const teams = Array.isArray(result?.teams) ? result.teams : []
  const teamsPlaces = normalizeTeamsPlaces(result?.teamsPlaces)
  const includeSet = new Set(
    (Array.isArray(includeTeamIds) ? includeTeamIds : [])
      .map((item) => toStringId(item))
      .filter(Boolean),
  )
  const outOfCompetitionTeamIds = new Set(
    (Array.isArray(result?.gameTeams) ? result.gameTeams : [])
      .filter((entry) => Boolean(entry?.outOfCompetition))
      .map((entry) => toStringId(entry?.teamId))
      .filter(Boolean),
  )

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

  return rows
    .filter((row) => {
      const normalizedTeamId = toStringId(row.teamId)
      if (!normalizedTeamId) {
        return false
      }

      if (outOfCompetitionTeamIds.has(normalizedTeamId)) {
        return includeSet.has(normalizedTeamId)
      }

      return true
    })
    .sort((a, b) => {
      const aPlace = Number.isFinite(a.place)
        ? a.place
        : Number.MAX_SAFE_INTEGER
      const bPlace = Number.isFinite(b.place)
        ? b.place
        : Number.MAX_SAFE_INTEGER

      if (aPlace !== bPlace) {
        return aPlace - bPlace
      }

      return a.teamName.localeCompare(b.teamName, 'ru')
    })
}

const resolveInteractiveResultsUrl = ({ gameId, result }) => {
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

  return `/game/${encodeURIComponent(gameId)}/result`
}

const buildResponseData = ({
  gameId,
  game: _game,
  result,
  rows,
  userParticipationTeamIds,
}) => {
  const safeGameName =
    typeof _game.name === 'string' && _game.name.trim().length > 0
      ? _game.name.trim()
      : 'Без названия'
  const participantsCount =
    Number(result?.computed?.summary?.participantsCount) ||
    (Array.isArray(result?.teamsUsers) ? result.teamsUsers.length : 0)

  return {
    gameId,
    gameName: safeGameName,
    rows,
    teamsCount: rows.length,
    participantsCount,
    computed:
      result?.computed && typeof result.computed === 'object'
        ? result.computed
        : null,
    interactiveResultsUrl: resolveInteractiveResultsUrl({ gameId, result }),
    userParticipationTeamIds,
  }
}

const handleRequest = async ({ request, params, method }) => {
  const requestUrl = new URL(request.url)
  const resolvedParams = await params
  const { gameId } = resolvedParams ?? {}
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
    const session = await getServerSession(authOptions)
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
        creatorTelegramId: 1,
        creatorUserId: 1,
        moderators: 1,
        tasks: 1,
        result: 1,
        type: 1,
        prequel: 1,
      })
      .lean()

    if (!game) {
      return NextResponse.json(
        { success: false, error: 'Игра не найдена' },
        { status: 404 },
      )
    }

    const gameLocation =
      typeof game.location === 'string'
        ? game.location.trim().toLowerCase()
        : null
    const requestedLocation =
      typeof location === 'string' ? location.trim().toLowerCase() : null

    if (
      gameLocation &&
      requestedLocation &&
      gameLocation !== requestedLocation
    ) {
      return NextResponse.json(
        { success: false, error: 'Игра недоступна для выбранной площадки' },
        { status: 403 },
      )
    }

    const status =
      typeof game.status === 'string' ? game.status.toLowerCase() : ''
    if (status !== 'finished' && status !== 'closed') {
      return NextResponse.json(
        {
          success: false,
          error: 'Результаты доступны только для завершённых или закрытых игр',
        },
        { status: 403 },
      )
    }

    const identity = normalizeSessionIdentity(session)
    const canManageThisGame = hasGameManageAccess({ identity, game })

    if (method === 'GET' && Boolean(game.hideResult) && !canManageThisGame) {
      return NextResponse.json(
        {
          success: false,
          error: 'Просмотр результатов отключён в настройках игры',
        },
        { status: 403 },
      )
    }

    if (method === 'POST') {
      if (!canManageThisGame) {
        return NextResponse.json(
          {
            success: false,
            error: 'Недостаточно прав для формирования результатов',
          },
          { status: 403 },
        )
      }

      let built = null
      const beforeHistoryState = await fetchGameHistoryState({
        db,
        gameId: normalizedGameId,
        game,
      })

      // Refresh snapshots from live GamesTeams so prequelProgress is up-to-date
      // let gameForComputation = game
      // try {
      //   const freshSnapshots = await buildGameResultSnapshots({ db, gameId: normalizedGameId })
      //   if (
      //     Array.isArray(freshSnapshots?.gameTeams) &&
      //     freshSnapshots.gameTeams.length > 0
      //   ) {
      //     gameForComputation = {
      //       ...game,
      //       result: {
      //         ...(game.result && typeof game.result === 'object' ? game.result : {}),
      //         gameTeams: freshSnapshots.gameTeams,
      //         teams: freshSnapshots.teams,
      //         teamsUsers: freshSnapshots.teamsUsers,
      //       },
      //     }
      //   }
      // } catch (snapshotError) {
      //   console.warn('Failed to refresh snapshots for result rebuild, using stored snapshots', snapshotError)
      // }

      // try {
      //   built = await buildGameResultComputed({ game: gameForComputation })
      // }
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

      const updatedGame = await db
        .model('Games')
        .findByIdAndUpdate(
          normalizedGameId,
          { result: nextResult },
          { returnDocument: 'after', runValidators: true },
        )
        .lean()

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
      const finalGameForHistory = updatedGame || {
        ...game,
        result: updatedResult,
      }
      const afterHistoryState = await fetchGameHistoryState({
        db,
        gameId: normalizedGameId,
        game: finalGameForHistory,
      })
      await recordGameHistoryEntry({
        db,
        gameId: normalizedGameId,
        location: gameLocation,
        actionType: 'results_rebuilt',
        entityScope: 'result',
        actor: buildHistoryActorFromSession(session),
        beforeState: beforeHistoryState,
        afterState: afterHistoryState,
        snapshot: buildGameHistorySnapshot(afterHistoryState),
        context: {
          summary: 'Результаты игры пересчитаны',
        },
      })
      const userParticipationTeamIds = resolveUserParticipationTeamIds({
        result: updatedResult,
        session,
      })
      const rows = buildRows({
        result: updatedResult,
        includeTeamIds: userParticipationTeamIds,
      })

      return NextResponse.json(
        {
          success: true,
          data: buildResponseData({
            gameId: normalizedGameId,
            game: updatedGame || game,
            result: updatedResult,
            rows,
            userParticipationTeamIds,
          }),
          ratingUpdate: ratingsUpdateInfo,
        },
        { status: 200 },
      )
    }

    let result =
      game.result && typeof game.result === 'object' ? game.result : {}

    if (hasResultSnapshots(result) && !hasComputedResult(result)) {
      try {
        const built = await buildGameResultComputed({ game })
        const nextResult = {
          ...result,
          teamsPlaces: built.teamsPlaces,
          computed: built.computed,
        }

        const updatedGame = await db
          .model('Games')
          .findByIdAndUpdate(
            normalizedGameId,
            { result: nextResult },
            { returnDocument: 'after', runValidators: true },
          )
          .lean()

        result =
          updatedGame?.result && typeof updatedGame.result === 'object'
            ? updatedGame.result
            : nextResult
      } catch (rebuildError) {
        console.error('Failed to auto-build cabinet game result', rebuildError)
      }
    }

    const userParticipationTeamIds = resolveUserParticipationTeamIds({
      result,
      session,
    })
    const rows = buildRows({ result, includeTeamIds: userParticipationTeamIds })

    return NextResponse.json(
      {
        success: true,
        data: buildResponseData({
          gameId: normalizedGameId,
          game,
          result,
          rows,
          userParticipationTeamIds,
        }),
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
