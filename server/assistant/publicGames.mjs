import { MongoClient } from 'mongodb'
import { ASSISTANT_CITIES } from '../../helpers/assistantVisibility.mjs'

export const GAME_PROJECTION = Object.freeze({ _id: 1, name: 1, dateStart: 1, type: 1, participationMode: 1, paymentMode: 1, 'prices.price': 1, registrationOpen: 1, maxTeamPlayers: 1 })
export function buildGamesQuery(city, now = new Date()) {
  if (!Object.hasOwn(ASSISTANT_CITIES, city)) throw new Error('Неизвестный город')
  return { location: city, hidden: { $eq: false }, isPrivate: { $ne: true }, orderType: { $in: ['public', null] }, sourceOrderId: null, status: 'active', dateStart: { $gte: now } }
}

function safeTitle(value) {
  if (typeof value !== 'string' || value.length > 100 || !value.trim()) return null
  if (/[<>@\r\n]|https?:|www\.|\+?\d[\d\s()-]{8,}|ignore|instruction|system|prompt|секрет|инструкци|ключ|контакт|телефон/iu.test(value)) return null
  return value.trim()
}
export function toGameSources(games, city) {
  if (!Object.hasOwn(ASSISTANT_CITIES, city)) return []
  return games.slice(0, 5).flatMap((game, index) => {
    const id = String(game._id || '')
    const title = safeTitle(game.name)
    const date = new Date(game.dateStart)
    if (!/^[a-f\d]{24}$/i.test(id) || !title || !Number.isFinite(date.getTime())) return []
    const type = { classic: 'классический автоквест', photo: 'фотоквест', story: 'сюжетный квест' }[game.type] || 'формат уточните в карточке'
    const timeZone = city === 'ekb' ? 'Asia/Yekaterinburg' : 'Asia/Krasnoyarsk'
    const dateText = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'long', timeStyle: 'short', timeZone }).format(date)
    const price = 'Стоимость и тарифы — в описании игры.'
    const participation = game.participationMode === 'player' ? 'Индивидуальное участие.' : game.participationMode === 'team' ? 'Командное участие.' : 'Условия участия уточните в карточке.'
    const teamLimit = game.participationMode === 'team' && Number.isInteger(game.maxTeamPlayers) && game.maxTeamPlayers >= 1 && game.maxTeamPlayers <= 100 ? ` Максимум участников команды: ${game.maxTeamPlayers}.` : ''
    const registration = game.registrationOpen === false ? 'Регистрация закрыта.' : game.registrationOpen === true ? 'Регистрация открыта.' : 'Доступность регистрации уточните в карточке.'
    return [{ id: `game-${index + 1}`, title, href: `/game/${id}`, text: `${title} — ${dateText} (${ASSISTANT_CITIES[city]}). ${type}. ${participation}${teamLimit} ${registration} ${price}` }]
  })
}

export async function readPublicGames(city, signal) {
  if (!process.env.MONGODB_URI || !process.env.MONGODB_GLOBAL_DBNAME) return { available: false, games: [] }
  // Отдельный драйвер выполняет только find, без dbConnectGlobal и его создания индексов.
  const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 2000, connectTimeoutMS: 2000, socketTimeoutMS: 2000, maxPoolSize: 1 })
  try {
    const games = await client.db(process.env.MONGODB_GLOBAL_DBNAME).collection('games')
      .find(buildGamesQuery(city), { projection: GAME_PROJECTION, maxTimeMS: 1500, signal })
      .sort({ dateStart: 1 }).limit(5).toArray()
    return { available: true, games: toGameSources(games, city) }
  } catch {
    if (signal?.aborted) throw signal.reason
    return { available: false, games: [] }
  } finally {
    await client.close()
  }
}
