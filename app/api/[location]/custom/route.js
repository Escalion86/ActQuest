import CRUD from '@server/CRUD'
import { runLocationLegacyHandler } from '@app/api/_lib/runLocationLegacyHandler'

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
    case 'transactions':
      return 'Transactions'
    default:
      return false
  }
}

const execute = (request, params) =>
  runLocationLegacyHandler({
    request,
    params,
    handler: async (req, res) => {
      const { query } = req
      const collection = query.collection
      const actualCollection = collectionCheck(collection)

      if (!actualCollection) {
        return res.status(400).json({ success: false, error: 'No collection' })
      }
      delete query.collection

      return CRUD(actualCollection, req, res)
    },
  })

export async function GET(request, { params }) {
  return execute(request, params)
}
export async function POST(request, { params }) {
  return execute(request, params)
}
export async function PUT(request, { params }) {
  return execute(request, params)
}
export async function PATCH(request, { params }) {
  return execute(request, params)
}
export async function DELETE(request, { params }) {
  return execute(request, params)
}
