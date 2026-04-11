import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import dbConnectGlobal from '@utils/dbConnectGlobal'
import buildGameResultComputed from '@server/buildGameResultComputed'
import updateParticipantsClosedStats from '@server/updateParticipantsClosedStats'
import updateParticipantsRatings from '@server/updateParticipantsRatings'

const isDeveloperRole = (role) => {
  if (typeof role !== 'string') {
    return false
  }

  return role.trim().toLowerCase() === 'dev'
}

const hasResultSnapshots = (game) =>
  Array.isArray(game?.result?.teams) &&
  game.result.teams.length > 0 &&
  Array.isArray(game?.result?.gameTeams) &&
  game.result.gameTeams.length > 0 &&
  Array.isArray(game?.result?.teamsUsers) &&
  game.result.teamsUsers.length > 0

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user || !isDeveloperRole(session.user.role)) {
    return NextResponse.json(
      { success: false, error: 'Недостаточно прав' },
      { status: 403 },
    )
  }

  try {
    const db = await dbConnectGlobal()
    if (!db) {
      throw new Error('Не удалось подключиться к базе данных')
    }

    const Games = db.model('Games')
    const finishedGames = await Games.find({ status: 'finished' })
      .sort({ dateStart: 1, _id: 1 })
      .select({
        _id: 1,
        status: 1,
        hideResult: 1,
        location: 1,
        dateStart: 1,
        dateStartFact: 1,
        dateEndFact: 1,
        taskDuration: 1,
        taskFailurePenalty: 1,
        manyCodesPenalty: 1,
        tasks: 1,
        result: 1,
      })
      .lean()

    let gamesClosed = 0
    let gamesWithRebuiltResults = 0
    let gamesWithoutSnapshots = 0
    let gamesSkippedMetrics = 0
    let usersUpdatedOperations = 0
    let teamsUpdatedOperations = 0
    let finalGlobalRatingsRebuild = {
      usersUpdated: 0,
      teamsUpdated: 0,
    }
    let lastClosedGameForGlobalRating = null

    for (const gameSource of finishedGames) {
      let game = gameSource

      if (hasResultSnapshots(game)) {
        try {
          const built = await buildGameResultComputed({ game })
          const nextResult = {
            ...(game.result && typeof game.result === 'object' ? game.result : {}),
            teamsPlaces: built.teamsPlaces,
            computed: built.computed,
          }

          game = {
            ...game,
            result: nextResult,
          }
          gamesWithRebuiltResults += 1
        } catch (buildError) {
          console.error(
            'Failed to rebuild result during force close (app)',
            buildError,
          )
        }
      }

      const hasTeamsPlacesAfterBuild =
        game?.result?.teamsPlaces &&
        typeof game.result.teamsPlaces === 'object' &&
        Object.keys(game.result.teamsPlaces).length > 0

      if (!hasTeamsPlacesAfterBuild && !hasResultSnapshots(game)) {
        gamesWithoutSnapshots += 1
      }

      const updatedGame = await Games.findByIdAndUpdate(
        game._id,
        {
          status: 'closed',
          result: game.result,
        },
        { returnDocument: 'after', runValidators: true },
      ).lean()

      if (!updatedGame) {
        continue
      }

      gamesClosed += 1
      lastClosedGameForGlobalRating = updatedGame

      const hasTeamsPlacesOnUpdatedGame =
        updatedGame?.result?.teamsPlaces &&
        typeof updatedGame.result.teamsPlaces === 'object' &&
        Object.keys(updatedGame.result.teamsPlaces).length > 0

      if (!hasTeamsPlacesOnUpdatedGame) {
        gamesSkippedMetrics += 1
        continue
      }

      const updateStatsInfo = await updateParticipantsClosedStats({
        db,
        game: updatedGame,
      })
      const updateRatingsInfo = await updateParticipantsRatings({
        db,
        game: updatedGame,
      })
      usersUpdatedOperations +=
        (Number(updateStatsInfo?.usersUpdated) || 0) +
        (Number(updateRatingsInfo?.usersUpdated) || 0)
      teamsUpdatedOperations +=
        (Number(updateStatsInfo?.teamsUpdated) || 0) +
        (Number(updateRatingsInfo?.teamsUpdated) || 0)
    }

    if (lastClosedGameForGlobalRating?._id) {
      finalGlobalRatingsRebuild = await updateParticipantsRatings({
        db,
        game: lastClosedGameForGlobalRating,
        updateAllEntities: true,
      })
      usersUpdatedOperations +=
        Number(finalGlobalRatingsRebuild?.usersUpdated) || 0
      teamsUpdatedOperations +=
        Number(finalGlobalRatingsRebuild?.teamsUpdated) || 0
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          finishedGamesFound: finishedGames.length,
          gamesClosed,
          gamesWithRebuiltResults,
          gamesWithoutSnapshots,
          gamesSkippedMetrics,
          usersUpdatedOperations,
          teamsUpdatedOperations,
          finalGlobalRatingsRebuild,
        },
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('Failed to close finished games (app)', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Не удалось принудительно закрыть завершенные игры',
      },
      { status: 500 },
    )
  }
}

