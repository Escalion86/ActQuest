import gameStop from 'telegram/commands/gameStop'
import dbConnectGlobal from '@utils/dbConnectGlobal'

export default async function handler(req, res) {
  const { query, method } = req
  const id = query.id
  const location = query.location

  switch (method) {
    case 'GET':
      try {
        if (id) {
          const db = await dbConnectGlobal()
          if (!db) return {}

          const jsonCommand = {
            gameId: id,
            confirm: true,
          }

          const result = await gameStop({ jsonCommand, location, db })
          const message = result.message

          return res?.status(200).json({ success: true, message })
        }
      } catch (error) {
        return res?.status(400).json({ success: false })
      }
  }
  return res?.status(400).json({ success: false })
}
