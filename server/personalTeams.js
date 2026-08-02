import { toStringId } from '@helpers/idAndDate'

export const PERSONAL_TEAM_KIND = 'personal'

export const isPersonalTeam = (team) => team?.kind === PERSONAL_TEAM_KIND

const normalizeLocation = (value) =>
  typeof value === 'string' ? value.trim().toLowerCase() : ''

const normalizeDisplayName = (user) => {
  const name = typeof user?.name === 'string' ? user.name.trim() : ''
  if (name) return name

  const username =
    typeof user?.username === 'string'
      ? user.username.trim().replace(/^@/, '')
      : ''
  if (username) return `@${username}`

  const userId = toStringId(user?._id ?? user?.id)
  return userId ? `Игрок ${userId.slice(-6)}` : 'Игрок'
}

export const findOrCreatePersonalTeam = async ({ db, user, location }) => {
  const userId = toStringId(user?._id ?? user?.id)
  const normalizedLocation = normalizeLocation(location)
  if (!db || !userId || !normalizedLocation) {
    throw new Error('Недостаточно данных для создания персональной команды')
  }

  const displayName = normalizeDisplayName(user)
  const Teams = db.model('Teams')
  const TeamsUsers = db.model('TeamsUsers')

  const filter = {
    kind: PERSONAL_TEAM_KIND,
    ownerUserId: userId,
    location: normalizedLocation,
  }
  const update = {
    $set: {
      name: displayName,
      name_lowered: displayName.toLowerCase(),
      open: false,
      systemManaged: true,
    },
    $setOnInsert: {
      kind: PERSONAL_TEAM_KIND,
      ownerUserId: userId,
      location: normalizedLocation,
      description: '',
    },
  }

  let team
  try {
    team = await Teams.findOneAndUpdate(filter, update, {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }).lean()
  } catch (error) {
    if (error?.code !== 11000) {
      throw error
    }
    team = await Teams.findOne(filter).lean()
  }

  const teamId = toStringId(team?._id)
  if (!teamId) {
    throw new Error('Не удалось создать персональную команду')
  }

  await TeamsUsers.findOneAndUpdate(
    { teamId, userId },
    {
      $set: {
        role: 'captain',
        userId,
        userTelegramId:
          user?.telegramId !== null &&
          user?.telegramId !== undefined &&
          Number.isFinite(Number(user.telegramId))
            ? Number(user.telegramId)
            : null,
      },
      $setOnInsert: { teamId },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )

  return team
}
