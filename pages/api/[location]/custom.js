import CRUD from '@server/CRUD'

const collectionCheck = (collection) => {
  if (!collection) return false
  const lowercaseCollection = collection.toLowerCase()
  switch (lowercaseCollection) {
    case 'users':
      return 'Users'
    case 'games':
      return 'Games'
    case 'gamesteams':
      return 'GamesTeams'
    case 'lastcommands':
      return 'LastCommands'
    case 'sitesettings':
      return 'SiteSettings'
    case 'teams':
      return 'Teams'
    case 'teamsusers':
      return 'TeamsUsers'
    case 'usersgamespayments':
      return 'UsersGamesPayments'
    default:
      return false
  }
}

export default async function handler(req, res) {
  const { query } = req
  const collection = query.collection
  const actualCollection = collectionCheck(collection)

  if (!actualCollection)
    return res?.status(400).json({ success: false, error: 'No collection' })
  delete query.collection

  return await CRUD(actualCollection, req, res)
}
