import normalizeUserProfile from '@helpers/normalizeUserProfile'
import ensureRole from '@helpers/ensureRole'
import { ensureDateISOString, toStringId } from '@helpers/idAndDate'
import resolveEntityRating from '@helpers/resolveEntityRating'

const DEFAULT_SORT = 'registration_desc'
const ALLOWED_SORTS = new Set(['rating', 'games_desc', 'registration_desc'])

const normalizeSortBy = (value) => {
  if (typeof value !== 'string') {
    return DEFAULT_SORT
  }

  const normalized = value.trim().toLowerCase()
  return ALLOWED_SORTS.has(normalized) ? normalized : DEFAULT_SORT
}

const compareByRating = (first, second) => {
  const firstRank = Number(first?.rating?.rank)
  const secondRank = Number(second?.rating?.rank)
  const firstEligible = Boolean(first?.rating?.isEligible) && Number.isFinite(firstRank)
  const secondEligible = Boolean(second?.rating?.isEligible) && Number.isFinite(secondRank)

  if (firstEligible && secondEligible) {
    if (firstRank !== secondRank) {
      return firstRank - secondRank
    }
    return (second?.gamesCount ?? 0) - (first?.gamesCount ?? 0)
  }

  if (firstEligible && !secondEligible) {
    return -1
  }

  if (!firstEligible && secondEligible) {
    return 1
  }

  return (second?.gamesCount ?? 0) - (first?.gamesCount ?? 0)
}

const sortUsers = (users, sortBy) => {
  const resolvedSortBy = normalizeSortBy(sortBy)
  const items = Array.isArray(users) ? [...users] : []

  if (resolvedSortBy === 'rating') {
    return items.sort(compareByRating)
  }

  if (resolvedSortBy === 'games_desc') {
    return items.sort((first, second) => (second?.gamesCount ?? 0) - (first?.gamesCount ?? 0))
  }

  return items.sort((first, second) => {
    const firstTime = first?.createdAt ? new Date(first.createdAt).getTime() : 0
    const secondTime = second?.createdAt ? new Date(second.createdAt).getTime() : 0
    return secondTime - firstTime
  })
}

const normalizeUserForAdmin = ({
  userDoc,
  membershipsByUser,
  teamsMap,
  location,
}) => {
  const baseProfile = normalizeUserProfile(userDoc)
  const numericTelegramId = Number.isFinite(userDoc?.telegramId)
    ? Number(userDoc.telegramId)
    : null
  const telegramId = numericTelegramId !== null ? String(numericTelegramId) : ''
  const memberships = membershipsByUser[telegramId] ?? []

  const teams = memberships
    .map((membership) => {
      const teamId = membership.teamId
      const team = teamsMap[teamId] ?? null

      if (!team) {
        return null
      }

      const role = membership.role === 'capitan' ? 'capitan' : 'participant'
      const teamGamesCount = Number.isFinite(Number(team?.gamesCount))
        ? Number(team.gamesCount)
        : 0

      return {
        id: teamId,
        name: team.name,
        role,
        isCaptain: role === 'capitan',
        gamesCount: teamGamesCount,
        updatedAt: ensureDateISOString(team.updatedAt),
      }
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.isCaptain === b.isCaptain) {
        return a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' })
      }

      return a.isCaptain ? -1 : 1
    })

  const playedGamesCount = Number.isFinite(Number(userDoc?.gameStats?.playedGamesCount))
    ? Number(userDoc.gameStats.playedGamesCount)
    : 0

  return {
    ...baseProfile,
    globalUserId: userDoc?.globalUserId ? String(userDoc.globalUserId) : null,
    telegramId,
    role: ensureRole(userDoc?.role),
    createdAt: ensureDateISOString(userDoc?.createdAt),
    updatedAt: ensureDateISOString(userDoc?.updatedAt),
    rating: resolveEntityRating({ entity: userDoc, location }),
    teams,
    teamsCount: teams.length,
    gamesCount: playedGamesCount,
  }
}

const toPositiveInteger = (value, fallback) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric < 0) {
    return fallback
  }
  return Math.floor(numeric)
}

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const buildUsersQuery = (search) => {
  const normalizedSearch =
    typeof search === 'string' ? search.trim() : ''

  if (!normalizedSearch) {
    return {}
  }

  const regex = new RegExp(escapeRegExp(normalizedSearch), 'i')
  const query = {
    $or: [
      { name: regex },
      { username: regex },
      { globalUserId: regex },
    ],
  }

  const numericSearch = Number(normalizedSearch)
  if (Number.isFinite(numericSearch)) {
    query.$or.push({ telegramId: numericSearch })
    query.$or.push({ phone: numericSearch })
  }

  return query
}

const normalizeRoleFilter = (roleFilter) => {
  if (typeof roleFilter !== 'string') {
    return null
  }

  const normalized = roleFilter.trim().toLowerCase()
  if (!normalized || normalized === 'all') {
    return null
  }

  return ensureRole(normalized)
}

const fetchAdminUsersForCabinet = async ({
  db,
  offset = 0,
  limit = 10,
  search = '',
  roleFilter = 'all',
  sortBy = DEFAULT_SORT,
  location = null,
}) => {
  if (!db) {
    return { users: [], hasMore: false }
  }

  const UsersModel = db.model('Users')
  const TeamsUsersModel = db.model('TeamsUsers')
  const TeamsModel = db.model('Teams')

  const queryOffset = toPositiveInteger(offset, 0)
  const queryLimit = toPositiveInteger(limit, 10)

  const usersQuery = buildUsersQuery(search)
  const normalizedRoleFilter = normalizeRoleFilter(roleFilter)
  if (normalizedRoleFilter) {
    usersQuery.role = normalizedRoleFilter
  }
  const resolvedSortBy = normalizeSortBy(sortBy)

  // Основной сценарий (по умолчанию в UI): сортировка по дате регистрации.
  // Выполняем пагинацию на уровне БД, чтобы не загружать весь массив пользователей.
  let usersSlice
  let hasMore

  if (resolvedSortBy === 'registration_desc') {
    const usersDocs = await UsersModel.find(usersQuery)
      .sort({ createdAt: -1, _id: -1 })
      .skip(queryOffset)
      .limit(queryLimit + 1)
      .lean()

    if (!usersDocs.length) {
      return { users: [], hasMore: false }
    }

    hasMore = usersDocs.length > queryLimit
    usersSlice = hasMore ? usersDocs.slice(0, queryLimit) : usersDocs
  } else {
    // Для производных сортировок (рейтинг/кол-во игр) нужно считать поля после нормализации.
    // Оставляем in-memory сортировку, но применяем её только для явно выбранных режимов.
    const usersDocs = await UsersModel.find(usersQuery)
      .sort({ name: 1, _id: 1 })
      .lean()

    if (!usersDocs.length) {
      return { users: [], hasMore: false }
    }

    const membershipTelegramIdsForAll = Array.from(
      new Set(
        usersDocs
          .map((userDoc) =>
            Number.isFinite(userDoc?.telegramId) ? Number(userDoc.telegramId) : null
          )
          .filter((id) => id !== null)
      )
    )

    const membershipsDocsForAll = membershipTelegramIdsForAll.length
      ? await TeamsUsersModel.find({ userTelegramId: { $in: membershipTelegramIdsForAll } })
          .select({ teamId: 1, userTelegramId: 1, role: 1 })
          .lean()
      : []

    const teamIdsForAll = Array.from(
      new Set(
        membershipsDocsForAll
          .map((doc) => toStringId(doc?.teamId))
          .filter((teamId) => typeof teamId === 'string' && teamId.length > 0)
      )
    )

    const teamsDocsForAll = teamIdsForAll.length
      ? await TeamsModel.find({ _id: { $in: teamIdsForAll } })
          .select({ _id: 1, name: 1, updatedAt: 1, gameStats: 1 })
          .lean()
      : []

    const teamsMapForAll = teamsDocsForAll.reduce((acc, team) => {
      const id = toStringId(team?._id)
      if (id) {
        acc[id] = {
          id,
          name: typeof team?.name === 'string' ? team.name : '',
          updatedAt: team?.updatedAt ?? null,
          gamesCount: Number.isFinite(Number(team?.gameStats?.playedGamesCount))
            ? Number(team.gameStats.playedGamesCount)
            : 0,
        }
      }
      return acc
    }, {})

    const membershipsByUserForAll = membershipsDocsForAll.reduce((acc, doc) => {
      const telegramId = Number.isFinite(doc?.userTelegramId)
        ? String(doc.userTelegramId)
        : null
      const teamId = toStringId(doc?.teamId)

      if (!telegramId || !teamId) {
        return acc
      }

      if (!acc[telegramId]) {
        acc[telegramId] = []
      }

      acc[telegramId].push({
        teamId,
        role: doc?.role === 'capitan' ? 'capitan' : 'participant',
      })

      return acc
    }, {})

    const allUsers = usersDocs.map((userDoc) =>
      normalizeUserForAdmin({
        userDoc,
        membershipsByUser: membershipsByUserForAll,
        teamsMap: teamsMapForAll,
        location,
      })
    )

    const sortedUsers = sortUsers(allUsers, resolvedSortBy)
    const pagedUsers = sortedUsers.slice(queryOffset, queryOffset + queryLimit)
    const pagedHasMore = sortedUsers.length > queryOffset + queryLimit

    return { users: pagedUsers, hasMore: pagedHasMore }
  }

  const membershipTelegramIds = Array.from(
    new Set(
      usersSlice
        .map((userDoc) =>
          Number.isFinite(userDoc?.telegramId) ? Number(userDoc.telegramId) : null
        )
        .filter((id) => id !== null)
    )
  )

  const membershipsDocs = membershipTelegramIds.length
    ? await TeamsUsersModel.find({ userTelegramId: { $in: membershipTelegramIds } })
        .select({ teamId: 1, userTelegramId: 1, role: 1 })
        .lean()
    : []

  const teamIds = Array.from(
    new Set(
      membershipsDocs
        .map((doc) => toStringId(doc?.teamId))
        .filter((teamId) => typeof teamId === 'string' && teamId.length > 0)
    )
  )

  const teamsDocs = teamIds.length
    ? await TeamsModel.find({ _id: { $in: teamIds } })
        .select({ _id: 1, name: 1, updatedAt: 1, gameStats: 1 })
        .lean()
    : []

  const teamsMap = teamsDocs.reduce((acc, team) => {
    const id = toStringId(team?._id)
    if (id) {
      acc[id] = {
        id,
        name: typeof team?.name === 'string' ? team.name : '',
        updatedAt: team?.updatedAt ?? null,
        gamesCount: Number.isFinite(Number(team?.gameStats?.playedGamesCount))
          ? Number(team.gameStats.playedGamesCount)
          : 0,
      }
    }
    return acc
  }, {})

  const membershipsByUser = membershipsDocs.reduce((acc, doc) => {
    const telegramId = Number.isFinite(doc?.userTelegramId)
      ? String(doc.userTelegramId)
      : null
    const teamId = toStringId(doc?.teamId)

    if (!telegramId || !teamId) {
      return acc
    }

    if (!acc[telegramId]) {
      acc[telegramId] = []
    }

    acc[telegramId].push({
      teamId,
      role: doc?.role === 'capitan' ? 'capitan' : 'participant',
    })

    return acc
  }, {})

  const users = usersSlice
    .map((userDoc) =>
      normalizeUserForAdmin({
        userDoc,
        membershipsByUser,
        teamsMap,
        location,
      })
    )
  return { users, hasMore }
}

export default fetchAdminUsersForCabinet
