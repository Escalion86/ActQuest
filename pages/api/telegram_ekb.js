import telegramCRUD from '@server/telegramCRUD'

export default async function handler(req, res) {
  return telegramCRUD(req, res, 'ekb')
}
