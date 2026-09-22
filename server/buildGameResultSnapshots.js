import { toStringId } from '@helpers/idAndDate'
import { hasClassicVariants } from '@helpers/classicVariants'
import { runClassicVariants } from '@server/classicVariantsEngine'

const buildGameResultSnapshots = async ({ db, gameId }) => {
  const normalizedGameId = toStringId(gameId)
  if (!normalizedGameId) {
    throw new Error(
      'Не передан идентификатор игры для формирования снапшота результатов',
    )
  }

  const GamesTeams = db.model('GamesTeams')
  const Teams = db.model('Teams')
  const TeamsUsers = db.model('TeamsUsers')

  let gameTeams = await GamesTeams.find({ gameId: normalizedGameId }).lean()
  const game = await db.model('Games').findById(normalizedGameId).lean()
  if (hasClassicVariants(game) && game.dateEndFact) {
    gameTeams = gameTeams.map((gameTeam) => gameTeam.startTime?.some(Boolean)
      ? runClassicVariants({ game: { ...game, status: 'started' }, gameTeam, now: new Date(game.dateEndFact) }).gameTeam
      : gameTeam)
  }
  const teamIds = Array.from(
    new Set(gameTeams.map((item) => toStringId(item?.teamId)).filter(Boolean)),
  )

  const teams = teamIds.length
    ? await Teams.find({ _id: { $in: teamIds } }).lean()
    : []
  const teamsUsers = teamIds.length
    ? await TeamsUsers.find({ teamId: { $in: teamIds } }).lean()
    : []

  return {
    teams,
    gameTeams,
    teamsUsers,
  }
}

export default buildGameResultSnapshots
