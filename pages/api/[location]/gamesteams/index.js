import CRUD from '@server/CRUD'

export default async function handler(req, res) {
  return await CRUD('GamesTeams', req, res)
}
