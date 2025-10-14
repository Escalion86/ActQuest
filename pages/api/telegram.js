import telegramCRUD from '@server/telegramCRUD'

export default async function handler(req, res) {
  console.log('get!!! :>> ')
  return telegramCRUD(req, res, 'krsk')
}
