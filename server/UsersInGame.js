import Games from '@models/Games'
import GamesTeams from '@models/GamesTeams'
import Teams from '@models/Teams'
import TeamsUsers from '@models/TeamsUsers'
import Users from '@models/Users'
import dbConnect from '@utils/dbConnect'

export default async function UsersInGame(req, res) {
  const { query, method } = req

  const id = query?.id
  const domen = query?.domen

  switch (method) {
    case 'GET':
      try {
        await dbConnect(domen)
        const game = await Games.findById(id).lean()
        console.log('game :>> ', game)
        const gameTeams = await GamesTeams.find({ gameId: id }).lean()
        console.log('gameTeams :>> ', gameTeams)
        const teamsIds = gameTeams.map((gameTeam) => gameTeam.teamId)
        const teams = await Teams.find({
          _id: { $in: teamsIds },
        }).lean()
        console.log('teams :>> ', teams)
        const teamsUsers = await TeamsUsers.find({
          teamId: { $in: teamsIds },
        }).lean()
        console.log('teamsUsers :>> ', teamsUsers)
        const usersIds = teamsUsers.map((teamsUser) => teamsUser.userTelegramId)
        const users = await Users.find({
          _id: { $in: usersIds },
        }).lean()
        console.log('users :>> ', users)
        return res?.status(200).json({
          success: true,
          data: { game, gameTeams, teams, teamsUsers, users },
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
