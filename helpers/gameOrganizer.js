export const normalizeGameOrganizerId = (value) => {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed || null
  }

  if (value !== null && value !== undefined && typeof value.toString === 'function') {
    const result = value.toString()
    return result === '[object Object]' ? null : normalizeGameOrganizerId(result)
  }

  return null
}

export const normalizeGameOrganizerRole = (value) =>
  typeof value === 'string' ? value.trim().toLowerCase() : ''

export const canAssignGameOrganizer = (user) => {
  const role = normalizeGameOrganizerRole(user?.role)
  return role === 'admin' || role === 'dev'
}

export const normalizeGameOrganizerTelegramId = (value) => {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null
  }

  return Math.trunc(numeric)
}

export const resolveGameOrganizerForCreate = ({
  requestedCreatorUserId,
  requestedCreatorDoc,
  sessionCreatorUserId,
  sessionCreatorTelegramId,
}) => {
  const normalizedRequestedCreatorUserId =
    normalizeGameOrganizerId(requestedCreatorUserId)

  if (!normalizedRequestedCreatorUserId) {
    return {
      creatorUserId: normalizeGameOrganizerId(sessionCreatorUserId),
      creatorTelegramId: normalizeGameOrganizerTelegramId(
        sessionCreatorTelegramId,
      ),
    }
  }

  const creatorDocId = normalizeGameOrganizerId(
    requestedCreatorDoc?._id ?? requestedCreatorDoc?.id,
  )

  if (!requestedCreatorDoc || creatorDocId !== normalizedRequestedCreatorUserId) {
    throw new Error('Организатор игры не найден')
  }

  if (!canAssignGameOrganizer(requestedCreatorDoc)) {
    throw new Error(
      'Организатором игры может быть только администратор или разработчик',
    )
  }

  return {
    creatorUserId: creatorDocId,
    creatorTelegramId: normalizeGameOrganizerTelegramId(
      requestedCreatorDoc.telegramId,
    ),
  }
}
