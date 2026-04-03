import dbConnectGlobal from '@utils/dbConnectGlobal'
import normalizeUserProfile from '@helpers/normalizeUserProfile'

const toFiniteNumberOrNull = (value) => {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

const resolveUserLookupFilter = (sessionUser) => {
  if (!sessionUser || typeof sessionUser !== 'object') {
    return null
  }

  const globalUserId =
    typeof sessionUser.globalUserId === 'string' && sessionUser.globalUserId
      ? sessionUser.globalUserId
      : typeof sessionUser._id === 'string' && sessionUser._id
        ? sessionUser._id
        : null
  if (globalUserId) {
    return { _id: globalUserId }
  }

  const phone = toFiniteNumberOrNull(sessionUser.phone)
  if (phone !== null) {
    return { phone }
  }

  const telegramId = toFiniteNumberOrNull(sessionUser.telegramId)
  if (telegramId !== null) {
    return { telegramId }
  }

  const vkId = toFiniteNumberOrNull(sessionUser.vkId)
  if (vkId !== null) {
    return { vkId }
  }

  return null
}

export const loadCabinetAppProfile = async (session) => {
  const db = await dbConnectGlobal()
  if (!db) {
    return normalizeUserProfile({
      _id: session?.user?.globalUserId ?? session?.user?._id ?? null,
      name: session?.user?.name ?? '',
      username: session?.user?.username ?? '',
      role: session?.user?.role ?? 'client',
      currentLocation: session?.user?.location ?? null,
      accountLocation: session?.user?.location ?? null,
      phone: session?.user?.phone ?? '',
      photoUrl: session?.user?.photoUrl ?? '',
    })
  }

  const lookupFilter = resolveUserLookupFilter(session?.user)
  if (!lookupFilter) {
    return normalizeUserProfile({
      _id: session?.user?.globalUserId ?? session?.user?._id ?? null,
      name: session?.user?.name ?? '',
      username: session?.user?.username ?? '',
      role: session?.user?.role ?? 'client',
      currentLocation: session?.user?.location ?? null,
      accountLocation: session?.user?.location ?? null,
      phone: session?.user?.phone ?? '',
      photoUrl: session?.user?.photoUrl ?? '',
    })
  }

  const userDoc = await db
    .model('Users')
    .findOne(lookupFilter)
    .select({
      _id: 1,
      name: 1,
      username: 1,
      photoUrl: 1,
      phone: 1,
      about: 1,
      preferences: 1,
      role: 1,
      authMethod: 1,
      telegramId: 1,
      vkId: 1,
      globalUserId: 1,
      accountLocation: 1,
      currentLocation: 1,
      languageCode: 1,
      isPremium: 1,
      rating: 1,
    })
    .lean()

  if (!userDoc) {
    return normalizeUserProfile({
      _id: session?.user?.globalUserId ?? session?.user?._id ?? null,
      name: session?.user?.name ?? '',
      username: session?.user?.username ?? '',
      role: session?.user?.role ?? 'client',
      currentLocation: session?.user?.location ?? null,
      accountLocation: session?.user?.location ?? null,
      phone: session?.user?.phone ?? '',
      photoUrl: session?.user?.photoUrl ?? '',
    })
  }

  return normalizeUserProfile(userDoc)
}

