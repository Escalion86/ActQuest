import { randomUUID } from 'node:crypto'
import { getGameRegistrationError } from '../helpers/gameRegistration.js'

const registrationFailure = (message, status = 409) =>
  Object.assign(new Error(message), { registrationStatus: status })

// Блокировка общая для игры, а не команды: подсчёт и запись нельзя разделять.
// Без автоматического истечения: зависший процесс не должен записать команду
// после передачи блокировки другому процессу. После аварии нужен ручной сброс.
export const registerGameTeam = async ({ db, gameId, teamId, role, createData = {} }) => {
  const Games = db.model('Games')
  const GamesTeams = db.model('GamesTeams')
  const token = randomUUID()
  const locked = await Games.findOneAndUpdate(
    { _id: gameId, registrationLock: null },
    { $set: { registrationLock: { token, acquiredAt: new Date() } } },
    { returnDocument: 'after', timestamps: false },
  ).lean()
  if (!locked) throw registrationFailure('Регистрация уже обрабатывается. Повторите попытку.')

  try {
    const manual = locked.participationMode !== 'player' && ['admin', 'dev'].includes(role)
    const error = getGameRegistrationError(locked, { manual })
    if (error) throw registrationFailure(error, 403)
    const existing = await GamesTeams.findOne({ gameId, teamId }).select({ _id: 1 }).lean()
    if (existing) throw registrationFailure('Команда уже зарегистрирована на эту игру')
    const count = await GamesTeams.countDocuments({ gameId })
    const capacityError = getGameRegistrationError(locked, { manual, teamsCount: count })
    if (capacityError) throw registrationFailure(capacityError)
    return await GamesTeams.create({ ...createData, gameId, teamId })
  } finally {
    await Games.updateOne(
      { _id: gameId, 'registrationLock.token': token },
      { $unset: { registrationLock: 1 } },
      { timestamps: false },
    )
  }
}
