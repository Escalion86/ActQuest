import Teams from '@models/Teams'
import CRUD from '@server/CRUD'

export default async function handler(req, res) {
  return await CRUD(Teams, req, res)
}
