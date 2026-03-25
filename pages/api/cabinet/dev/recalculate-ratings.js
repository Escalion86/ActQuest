import { getServerSession } from 'next-auth/next'

import { authOptions } from '@pages/api/auth/[...nextauth]'
import dbConnectGlobal from '@utils/dbConnectGlobal'
import updateParticipantsRatings from '@server/updateParticipantsRatings'
import updateParticipantsClosedStats from '@server/updateParticipantsClosedStats'
import buildGameResultComputed from '@server/buildGameResultComputed'

const isDeveloperRole = (role) => {
  if (typeof role !== 'string') {
    return false
  }

  return role.trim().toLowerCase() === 'dev'
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({ success: false, error: 'Метод не поддерживается' })
  }

  const session = await getServerSession(req, res, authOptions)
  if (!session?.user || !isDeveloperRole(session.user.role)) {
    return res.status(403).json({ success: false, error: 'Недостаточно прав' })
  }

  try {
    const db = await dbConnectGlobal()
    if (!db) {
      throw new Error('Не удалось подключиться к базе данных')
    }

    const Games = db.model('Games')
    const ratedGames = await Games.find({
      status: { $in: ['finished', 'closed'] },
      isRated: { $ne: false },
    })
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

    await Promise.all([
      db.model('Users').updateMany(
        {},
        {
          $unset: {
            rating: '',
            ratingsByLocation: '',
            gameStats: '',
          },
        }
      ),
      db.model('Teams').updateMany(
        {},
        {
          $unset: {
            rating: '',
            ratingsByLocation: '',
            gameStats: '',
          },
        }
      ),
    ])

    let usersStatsUpdatedOperations = 0
    let teamsStatsUpdatedOperations = 0
    let usersUpdatedOperations = 0
    let teamsUpdatedOperations = 0
    let gamesWithRebuiltResults = 0
    let gamesSkippedNoSnapshots = 0

    for (const gameSource of ratedGames) {
      let game = gameSource
      try {
        const hasResultSnapshots =
          Array.isArray(game?.result?.teams) &&
          game.result.teams.length > 0 &&
          Array.isArray(game?.result?.gameTeams) &&
          game.result.gameTeams.length > 0 &&
          Array.isArray(game?.result?.teamsUsers) &&
          game.result.teamsUsers.length > 0

        if (!hasResultSnapshots) {
          gamesSkippedNoSnapshots += 1
          continue
        }

        const built = await buildGameResultComputed({ game })
        const nextResult = {
          ...(game.result && typeof game.result === 'object' ? game.result : {}),
          teamsPlaces: built.teamsPlaces,
          computed: built.computed,
        }

        const updatedGame = await Games.findByIdAndUpdate(
          game._id,
          { result: nextResult },
          { new: true, runValidators: true }
        ).lean()

        if (updatedGame) {
          game = updatedGame
          gamesWithRebuiltResults += 1
        }
      } catch (buildError) {
        if (buildError?.code === 'RESULT_SNAPSHOTS_MISSING') {
          gamesSkippedNoSnapshots += 1
          continue
        }
        throw buildError
      }

      const statsUpdateInfo = await updateParticipantsClosedStats({ db, game })
      usersStatsUpdatedOperations += Number(statsUpdateInfo?.usersUpdated) || 0
      teamsStatsUpdatedOperations += Number(statsUpdateInfo?.teamsUpdated) || 0

      const ratingUpdateInfo = await updateParticipantsRatings({ db, game })
      usersUpdatedOperations += Number(ratingUpdateInfo?.usersUpdated) || 0
      teamsUpdatedOperations += Number(ratingUpdateInfo?.teamsUpdated) || 0
    }

    return res.status(200).json({
      success: true,
      data: {
        gamesProcessed: ratedGames.length,
        gamesWithRebuiltResults,
        gamesSkippedNoSnapshots,
        usersStatsUpdatedOperations,
        teamsStatsUpdatedOperations,
        usersUpdatedOperations,
        teamsUpdatedOperations,
      },
    })
  } catch (error) {
    console.error('Failed to recalculate ratings', error)
    return res.status(500).json({
      success: false,
      error: 'Не удалось полностью пересчитать рейтинг игроков и команд',
    })
  }
}
