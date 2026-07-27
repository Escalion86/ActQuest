import UsersInGame from '@server/UsersInGame'
import { runLocationLegacyHandler } from '@app/api/_lib/runLocationLegacyHandler'

const execute = (request, params) =>
  runLocationLegacyHandler({
    request,
    params,
    requireAuth: true,
    handler: async (req, res) => UsersInGame(req, res),
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
