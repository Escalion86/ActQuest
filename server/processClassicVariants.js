import { acquireGameProcessLock, releaseGameProcessLock } from './gameProcessLock.js'
import { runClassicVariants, CLASSIC_PROGRESS_FIELDS } from './classicVariantsEngine.js'
import getLocationTimeZone from '../helpers/locationTimeZone.js'

export default async function processClassicVariants({ game, gameTeam, gamesTeamsModel, ...input }) {
  const lock = await acquireGameProcessLock({ GamesTeams: gamesTeamsModel, teamId: gameTeam._id })
  if (!lock.acquired) return { gameTeam, result: { statusCode: 409, message: 'Другой запрос команды ещё обрабатывается.', retryable: true } }
  try {
    const stale = (input.message || input.action) && Number(gameTeam.activeNum || 0) !== Number(lock.gameTeam.activeNum || 0)
    const dynamicTimeCode = new Intl.DateTimeFormat('ru-RU', { timeZone: getLocationTimeZone(game.location), hour: '2-digit', minute: '2-digit', hour12: false }).format(input.now || new Date()).replace(':', '')
    const result = runClassicVariants({ game, gameTeam: lock.gameTeam, dynamicTimeCode, ...input, ...(stale ? { message: null, action: null } : {}) })
    if (stale) result.result = { statusCode: 409, message: 'Этап уже изменился. Обновите экран.', staleState: true }
    const updates = Object.fromEntries(CLASSIC_PROGRESS_FIELDS.filter((key) => result.gameTeam[key] !== undefined).map((key) => [key, result.gameTeam[key]]))
    if (JSON.stringify(updates) !== JSON.stringify(Object.fromEntries(Object.keys(updates).map((key) => [key, lock.gameTeam[key]])))) {
      const saved = await gamesTeamsModel.findOneAndUpdate({ _id: gameTeam._id, 'gameProcessLock.token': lock.token, 'gameProcessLock.expiresAt': { $gt: new Date() } }, { $set: updates }, { returnDocument: 'after' }).lean()
      if (!saved) throw new Error('Блокировка прогресса истекла. Повторите запрос.')
      result.gameTeam = saved
    }
    return result
  } finally {
    await releaseGameProcessLock({ GamesTeams: gamesTeamsModel, teamId: gameTeam._id, token: lock.token })
  }
}
