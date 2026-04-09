import { toStringId } from '@helpers/idAndDate'

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

  const gameTeams = await GamesTeams.find({ gameId: normalizedGameId }).lean()
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
