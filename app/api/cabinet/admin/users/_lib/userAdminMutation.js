import { LOCATIONS } from '@server/serverConstants'
import ensureRole from '@helpers/ensureRole'

export const sanitizeText = (value) =>
  typeof value === 'string' ? value.trim() : ''

export const sanitizeNullableText = (value) => {
  const normalized = sanitizeText(value)
  return normalized.length > 0 ? normalized : null
}

export const sanitizePhone = (value) => {
  if (value === null || value === undefined || value === '') return null
  const digits = String(value).replace(/\D/g, '')
  if (digits.length !== 11 || !digits.startsWith('7')) return null
  const asNumber = Number(digits)
  return Number.isFinite(asNumber) ? asNumber : null
}

export const normalizeRole = (value) =>
  typeof value === 'string' ? value.trim().toLowerCase() : ''

export const resolveAllowedLocations = () =>
  Object.entries(LOCATIONS)
    .filter(([, value]) => !value?.hidden)
    .map(([key]) => key)

export const normalizeLocation = (value) =>
  typeof value === 'string' ? value.trim().toLowerCase() : ''

export const assertUserRoleMutationAllowed = ({
  actorRole,
  targetCurrentRole,
  targetNextRole,
}) => {
  const isActorDeveloper = normalizeRole(actorRole) === 'dev'

  if (!isActorDeveloper && targetCurrentRole === 'dev') {
    return 'Только разработчик может изменять карточку пользователя с ролью «Разработчик».'
  }

  if (!isActorDeveloper && targetNextRole === 'dev') {
    return 'Только разработчик может назначать роль «Разработчик».'
  }

  return null
}

export const buildUserUpdatePayload = (body) => {
  const nextRole = ensureRole(body?.role)
  const allowedLocations = resolveAllowedLocations()
  const requestedLocation = normalizeLocation(body?.currentLocation)

  return {
    nextRole,
    payload: {
      name: sanitizeText(body?.name),
      username: sanitizeNullableText(body?.username),
      photoUrl: sanitizeNullableText(body?.photoUrl),
      phone: sanitizePhone(body?.phone),
      about: sanitizeText(body?.about),
      preferences: Array.isArray(body?.preferences)
        ? Array.from(
            new Set(
              body.preferences
                .map((item) => sanitizeText(item))
                .filter((item) => item.length > 0),
            ),
          )
        : [],
      role: nextRole,
      canBeGameModerator: Boolean(body?.canBeGameModerator),
      canBeGameAgent: Boolean(body?.canBeGameAgent),
      currentLocation:
        requestedLocation && allowedLocations.includes(requestedLocation)
          ? requestedLocation
          : null,
    },
    hasInvalidLocation:
      Boolean(requestedLocation) && !allowedLocations.includes(requestedLocation),
  }
}
