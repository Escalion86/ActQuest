import dbConnect from '@utils/dbConnect'

export default async function UsersInGame(req, res) {
  const { query, method } = req

  const id = query?.id
  const location = query?.location

  switch (method) {
    case 'GET':
      try {
        const db = await dbConnect(location)
        if (!db)
          return res?.status(400).json({ success: false, error: 'db error' })

        const game = await db.model('Games').findById(id).lean()
        const gameTeams = await db
          .model('GamesTeams')
          .find({ gameId: id })
          .lean()
        const teamsIds = gameTeams.map((gameTeam) => gameTeam.teamId)
        const teams = await db
          .model('Teams')
          .find({
            _id: { $in: teamsIds },
          })
          .lean()
        const teamsUsers = await db
          .model('TeamsUsers')
          .find({
            teamId: { $in: teamsIds },
          })
          .lean()
        const usersTelegramIds = teamsUsers.map(
          (teamsUser) => teamsUser.userTelegramId
        )
        const users = await db
          .model('Users')
          .find({
            telegramId: { $in: usersTelegramIds },
          })
          .lean()
        const usersWithTeams = users.map((user) => {
          const userTeam = teamsUsers.find(
            (teamsUser) => teamsUser.userTelegramId === user.telegramId
          )
          const team = teams.find((team) => String(team._id) == userTeam.teamId)

          return { ...user, team, roleInTeam: userTeam.role }
        })
        return res?.status(200).json({
          success: true,
          data: { game, gameTeams, teams, teamsUsers, users: usersWithTeams },
        })
      } catch (error) {
        console.log(error)
        return res?.status(400).json({ success: false, error })
      }
      break
    default:
      return res?.status(400).json({ success: false })
      break
  }
}
