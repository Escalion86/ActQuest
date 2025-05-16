import dbConnect from '@utils/dbConnect'
import gameProcess from 'telegram/commands/gameProcess'

export default async function handler(req, res) {
  const { query, method } = req
  const id = query.id
  const location = query.location

  switch (method) {
    case 'GET':
      try {
        if (id) {
          const db = await dbConnect(location)
          if (!db) return {}

          const data = await db.model('GamesTeams').findById(id).lean()
          if (!data) {
            return res?.status(400).json({ success: false })
          }
          const jsonCommand = {
            gameTeamId: id,
          }

          const result = await gameProcess({ jsonCommand, location, db })
          const message = result.message

          return res?.status(200).json({ success: true, message })
        }
      } catch (error) {
        return res?.status(400).json({ success: false })
      }
  }
  return res?.status(400).json({ success: false })
}
