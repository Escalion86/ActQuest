import { MongoClient, ObjectId } from 'mongodb'
import resolveSessionUserFilter from '../../helpers/resolveSessionUserFilter.js'
import { getCaptainRoleQuery } from '../../helpers/teamRoles.js'
import { getGameRegistrationError } from '../../helpers/gameRegistration.js'
import { buildGamesQuery, GAME_PROJECTION, toGameSources } from './publicGames.mjs'

const validId = value => typeof value === 'string' && /^[a-f\d]{24}$/i.test(value)
// Только read-only driver: ни моделей с autoIndex, ни findOrCreatePersonalTeam.
export async function readRegistration({ session, city, gameId, signal, createClient }) {
  const filter = resolveSessionUserFilter(session?.user)
  if (!filter || !validId(gameId) || (!createClient && (!process.env.MONGODB_URI || !process.env.MONGODB_GLOBAL_DBNAME))) return { available: false }
  const client = createClient ? createClient() : new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 2000, connectTimeoutMS: 2000, socketTimeoutMS: 2000, maxPoolSize: 1 })
  try {
    const db = client.db(process.env.MONGODB_GLOBAL_DBNAME)
    const options = projection => ({ projection, maxTimeMS: 1500, signal })
    // Идентичность только из проверенной сессии; fallback phone/vk/telegram остаётся на сервере.
    if (filter._id) {
      if (!validId(String(filter._id))) return { available: false }
      filter._id = new ObjectId(String(filter._id))
    }
    const user = await db.collection('users').findOne(filter, options({ _id: 1 }))
    if (!user) return { available: false }
    const userId = String(user._id)
    const game = await db.collection('games').findOne({ ...buildGamesQuery(city), _id: new ObjectId(gameId) }, options({ ...GAME_PROJECTION, location: 1, status: 1, maxTeams: 1 }))
    if (!game || !toGameSources([game], city).length) return { available: true, game: null }
    const memberships = await db.collection('teamsusers').find({ userId }, options({ _id: 0, teamId: 1, role: 1 })).limit(101).toArray()
    if (memberships.length > 100) return { available: false }
    const ids = [...new Set(memberships.map(m => m.teamId).filter(validId))]
    const teams = await db.collection('teams').find({ $or: [{ _id: { $in: ids.map(id => new ObjectId(id)) } }, { kind: 'personal', ownerUserId: userId, location: city }] }, options({ _id: 1, kind: 1, location: 1, ownerUserId: 1 })).limit(101).toArray()
    if (teams.length > 100) return { available: false }
    const eligible = teams.filter(t => t.location === city && (game.participationMode === 'player' ? t.kind === 'personal' && String(t.ownerUserId) === userId : t.kind !== 'personal' && ids.includes(String(t._id))))
    const registered = eligible.length > 0 && Boolean(await db.collection('gamesteams').findOne({ gameId: String(game._id), teamId: { $in: eligible.map(t => String(t._id)) } }, options({ _id: 1 })))
    const teamsCount = game.participationMode === 'player' || !Number.isSafeInteger(game.maxTeams) ? 0 : await db.collection('gamesteams').countDocuments({ gameId: String(game._id) }, { maxTimeMS: 1500, signal })
    // Та же точная роль, что в POST регистрации, без расширения прав нормализацией.
    return { available: true, game, registered, teamsCount, teams: teams.map(t => ({ kind: t.kind, location: t.location, captain: memberships.some(m => m.teamId === String(t._id) && getCaptainRoleQuery().$in.includes(m.role)) })) }
  } catch {
    if (signal?.aborted) throw signal.reason
    return { available: false }
  } finally { await client.close() }
}

export function registrationAdvice(context, session) {
  const links = [{ title: 'Ближайшие игры', href: '/cabinet/games-upcoming' }]
  const response = (mode, answer) => ({ success: true, mode, answer, links })
  if (!context?.available) return response('no-data', 'Не удалось проверить вашу запись. Попробуйте позже или посмотрите её в кабинете.')
  if (!context.game) return response('no-data', 'Не удалось найти эту игру в выбранном городе. Выберите другую из ближайших.')
  if (context.registered) return response('personalised', 'Вы или ваша команда уже зарегистрированы. Запись можно посмотреть в карточке игры.')
  if (session?.user?.role === 'ban') return response('personalised', 'Ваш профиль заблокирован, запись недоступна. Обратитесь к организатору.')
  const error = getGameRegistrationError(context.game, { teamsCount: context.teamsCount })
  if (error) return response('personalised', `${error}. Актуальные условия — в карточке игры.`)
  if (context.game.participationMode === 'player') return response('personalised', 'Это индивидуальная игра — команда не нужна. Откройте игру в кабинете и нажмите «Записаться».')
  const regular = (context.teams || []).filter(t => t.kind !== 'personal')
  const captains = regular.filter(t => t.captain && t.location === context.game.location)
  if (captains.length) return response('personalised', `Ваших команд в городе игры: ${captains.length}. Откройте игру в кабинете, нажмите «Присоединиться» и выберите команду.`)
  links.push({ title: 'Мои команды', href: '/cabinet/teams' })
  if (regular.some(t => t.captain)) return response('personalised', 'Вы капитан команды другого города. Для записи нужна команда в городе игры. Выберите такую команду или создайте её.')
  if (regular.length) return response('personalised', 'Команду записывает капитан. Попросите капитана записать вашу команду или создайте свою в городе игры.')
  return response('personalised', 'Сначала создайте команду в городе игры или присоединитесь к существующей. На игру команду записывает капитан.')
}
