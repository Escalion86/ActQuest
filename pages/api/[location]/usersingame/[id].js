import UsersInGame from '@server/UsersInGame'

export default async function handler(req, res) {
  return await UsersInGame(req, res)
}
