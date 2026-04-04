import telegramCRUD from '@server/telegramCRUD'
import { runLegacyHandler } from '@app/api/_lib/legacyHandlerAdapter'

const handler = async (req, res) => telegramCRUD(req, res, 'ekb')

export async function POST(request) {
  return runLegacyHandler({ request, handler })
}
