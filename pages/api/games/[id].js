import Games from '@models/Games'
import CRUD from '@server/CRUD'

export default async function handler(req, res) {
  console.log('games/[id] :>> ')
  return await CRUD(Games, req, res)
}
