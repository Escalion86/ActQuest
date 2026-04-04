import telegramCRUD from '@server/telegramCRUD'
import { runLegacyHandler } from '@app/api/_lib/legacyHandlerAdapter'

const handler = async (req, res) => {
  console.log('get!!! :>> ')
  return telegramCRUD(req, res, 'krsk')
}

export async function POST(request) {
  return runLegacyHandler({ request, handler })
}
