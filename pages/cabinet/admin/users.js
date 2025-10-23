import { useCallback, useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import Head from 'next/head'
import { useSession } from 'next-auth/react'

import CabinetLayout from '@components/cabinet/CabinetLayout'
import formatRelativeTimeFromNow from '@helpers/formatRelativeTimeFromNow'
import getSessionSafe from '@helpers/getSessionSafe'
import isUserAdmin from '@helpers/isUserAdmin'
import normalizeUserProfile from '@helpers/normalizeUserProfile'
import { USERS_ROLES } from '@helpers/constants'
import dbConnect from '@utils/dbConnect'

const roleLabels = {
  client: 'Пользователь',
  moder: 'Модератор',
  admin: 'Администратор',
  dev: 'Разработчик',
  ban: 'Заблокирован',
}

const toStringId = (value) => {
  if (!value && value !== 0) {
    return null
  }

  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'number') {
    return value.toString()
  }

  if (value && typeof value.toString === 'function') {
    const stringValue = value.toString()
    return stringValue === '[object Object]' ? null : stringValue
  }

  return null
}

const ensureDateISOString = (value) => {
  if (!value) {
    return null
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return null
  }

  return date.toISOString()
}

const ensureRole = (value) => {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim()
  }

  if (value) {
    return String(value)
  }

  return 'client'
}

const cloneUser = (user) => {
  if (!user) {
    return null
  }

  return {
    ...user,
    preferences: Array.isArray(user.preferences) ? [...user.preferences] : [],
    teams: Array.isArray(user.teams)
      ? user.teams.map((team) => ({ ...team }))
      : [],
  }
}

const normalizeUserForAdmin = ({
  userDoc,
  membershipsByUser,
  teamsMap,
  gamesIdsByTeam,
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
      const games = gamesIdsByTeam[teamId] ?? []

      return {
        id: teamId,
        name: team.name,
        role,
        isCaptain: role === 'capitan',
        gamesCount: games.length,
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

  const uniqueGameIds = new Set()
  memberships.forEach((membership) => {
    const ids = gamesIdsByTeam[membership.teamId] ?? []
    ids.forEach((id) => uniqueGameIds.add(id))
  })

  return {
    ...baseProfile,
    telegramId,
    role: ensureRole(userDoc?.role),
    createdAt: ensureDateISOString(userDoc?.createdAt),
    updatedAt: ensureDateISOString(userDoc?.updatedAt),
    teams,
    teamsCount: teams.length,
    gamesCount: uniqueGameIds.size,
  }
}

const ManageUsersPage = ({ initialUsers, initialLocation, session: initialSession }) => {
  const { data: session } = useSession()
  const activeSession = session ?? initialSession ?? null
  const location = activeSession?.user?.location ?? initialLocation ?? null
  const isAdmin = isUserAdmin({ role: activeSession?.user?.role })

  const [users, setUsers] = useState(initialUsers)
  const [persistedUsers, setPersistedUsers] = useState(initialUsers)
  const [selectedUserId, setSelectedUserId] = useState(initialUsers[0]?.id ?? null)
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [feedback, setFeedback] = useState(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    setUsers(initialUsers)
    setPersistedUsers(initialUsers)
    setSelectedUserId((prev) => {
      if (prev && initialUsers.some((user) => user.id === prev)) {
        return prev
      }

      return initialUsers[0]?.id ?? null
    })
  }, [initialUsers])

  const roleOptions = useMemo(() => {
    const baseOptions = USERS_ROLES.map(({ value, name }) => ({ value, name }))
    const knownRoles = new Set(baseOptions.map((option) => option.value))

    if (!knownRoles.has('ban')) {
      baseOptions.push({ value: 'ban', name: roleLabels.ban })
      knownRoles.add('ban')
    }

    users.forEach((user) => {
      if (user.role && !knownRoles.has(user.role)) {
        baseOptions.push({ value: user.role, name: roleLabels[user.role] ?? user.role })
        knownRoles.add(user.role)
      }
    })

    return baseOptions
  }, [users])

  const filteredUsers = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase()

    return users.filter((user) => {
      if (roleFilter !== 'all' && user.role !== roleFilter) {
        return false
      }

      if (!normalizedQuery) {
        return true
      }

      const haystack = [user.name, user.username, user.telegramId]
        .map((value) => (typeof value === 'string' ? value.toLowerCase() : ''))
        .filter(Boolean)

      return haystack.some((value) => value.includes(normalizedQuery))
    })
  }, [users, roleFilter, searchQuery])

  useEffect(() => {
    if (filteredUsers.length === 0) {
      setSelectedUserId(null)
      return
    }

    setSelectedUserId((prev) => {
      if (prev && filteredUsers.some((user) => user.id === prev)) {
        return prev
      }

      return filteredUsers[0]?.id ?? null
    })
  }, [filteredUsers])

  const selectedUser = useMemo(
    () => users.find((user) => user.id === selectedUserId) ?? null,
    [selectedUserId, users]
  )

  const persistedSelectedUser = useMemo(
    () => persistedUsers.find((user) => user.id === selectedUserId) ?? null,
    [persistedUsers, selectedUserId]
  )

  useEffect(() => {
    setFeedback(null)
  }, [selectedUserId])

  const isDirty = useMemo(() => {
    if (!selectedUser || !persistedSelectedUser) {
      return false
    }

    return selectedUser.role !== persistedSelectedUser.role
  }, [persistedSelectedUser, selectedUser])

  const handleRoleChange = useCallback(
    (role) => {
      if (!selectedUserId) {
        return
      }

      setFeedback(null)
      setUsers((prevUsers) =>
        prevUsers.map((user) =>
          user.id === selectedUserId
            ? {
                ...user,
                role,
              }
            : user
        )
      )
    },
    [selectedUserId]
  )

  const handleReset = useCallback(() => {
    if (!selectedUserId || !persistedSelectedUser) {
      return
    }

    const snapshot = cloneUser(persistedSelectedUser)

    setUsers((prevUsers) =>
      prevUsers.map((user) => (user.id === selectedUserId && snapshot ? snapshot : user))
    )
    setFeedback(null)
  }, [persistedSelectedUser, selectedUserId])

  const handleSave = useCallback(async () => {
    if (!selectedUser || !persistedSelectedUser || !location) {
      return
    }

    if (selectedUser.role === persistedSelectedUser.role) {
      return
    }

    setIsSaving(true)
    setFeedback(null)

    try {
      const response = await fetch(
        `/api/${location}/custom?collection=users&id=${selectedUser.id}`,
        {
          method: 'PUT',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ data: { role: selectedUser.role } }),
        }
      )

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(errorText || 'Не удалось обновить пользователя')
      }

      const json = await response.json()

      if (!json?.success) {
        throw new Error(json?.error || 'Не удалось сохранить изменения')
      }

      const updatedDoc = json.data ?? {}
      const baseProfile = normalizeUserProfile(updatedDoc)
      const updatedUser = {
        ...cloneUser(selectedUser),
        ...baseProfile,
        telegramId: Number.isFinite(updatedDoc?.telegramId)
          ? String(updatedDoc.telegramId)
          : selectedUser.telegramId,
        role: ensureRole(updatedDoc?.role),
        createdAt: ensureDateISOString(updatedDoc?.createdAt) ?? selectedUser.createdAt,
        updatedAt: ensureDateISOString(updatedDoc?.updatedAt) ?? new Date().toISOString(),
      }

      setUsers((prevUsers) =>
        prevUsers.map((user) => (user.id === selectedUser.id ? updatedUser : user))
      )
      setPersistedUsers((prevUsers) =>
        prevUsers.map((user) => (user.id === selectedUser.id ? cloneUser(updatedUser) : user))
      )
      setFeedback({
        type: 'success',
        message: 'Роль пользователя обновлена',
      })
    } catch (error) {
      console.error('Failed to update user role', error)
      setFeedback({
        type: 'error',
        message: error?.message || 'Не удалось сохранить изменения',
      })
    } finally {
      setIsSaving(false)
    }
  }, [location, persistedSelectedUser, selectedUser])

  const filterOptions = useMemo(
    () => [
      { value: 'all', name: 'Все роли' },
      ...roleOptions.map((option) => ({ value: option.value, name: option.name })),
    ],
    [roleOptions]
  )

  if (!isAdmin) {
    return (
      <>
        <Head>
          <title>ActQuest — Управление пользователями</title>
        </Head>
        <CabinetLayout
          title="Управление пользователями"
          description="Доступ ограничен: административные права отсутствуют."
          activePage="admin"
        >
          <section className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm">
            <p className="text-sm text-slate-600">
              У вас нет доступа к управлению пользователями. Если вы считаете, что это ошибка, обратитесь к
              главному организатору.
            </p>
          </section>
        </CabinetLayout>
      </>
    )
  }

  return (
    <>
      <Head>
        <title>ActQuest — Управление пользователями</title>
      </Head>
      <CabinetLayout
        title="Управление пользователями"
        description="Просматривайте профили участников, управляйте их ролями и отслеживайте активность."
        activePage="admin"
      >
        <section className="grid gap-6 md:grid-cols-5">
          <div className="md:col-span-2 space-y-4">
            <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm">
              <p className="text-sm font-semibold text-primary">Все пользователи</p>
              <p className="mt-1 text-xs text-slate-500">
                Всего: {users.length}. Выберите участника, чтобы просмотреть детали и обновить его роль.
              </p>
            </div>

            <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-3">
              <div>
                <label htmlFor="user-search" className="text-xs font-semibold text-slate-500">
                  Поиск
                </label>
                <input
                  id="user-search"
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Введите имя, ник или Telegram ID"
                  className="w-full px-3 py-2 mt-1 text-sm border rounded-xl border-slate-200 focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label htmlFor="user-role-filter" className="text-xs font-semibold text-slate-500">
                  Роль
                </label>
                <select
                  id="user-role-filter"
                  value={roleFilter}
                  onChange={(event) => setRoleFilter(event.target.value)}
                  className="w-full px-3 py-2 mt-1 text-sm border rounded-xl border-slate-200 focus:border-primary focus:ring-1 focus:ring-primary"
                >
                  {filterOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {filteredUsers.length > 0 ? (
              <ul className="space-y-3">
                {filteredUsers.map((user) => {
                  const isActive = user.id === selectedUserId
                  const lastUpdateLabel = user.updatedAt
                    ? formatRelativeTimeFromNow(user.updatedAt)
                    : '—'

                  return (
                    <li key={user.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedUserId(user.id)}
                        className={`w-full text-left p-4 border rounded-2xl transition ${
                          isActive
                            ? 'border-primary bg-blue-50 shadow-sm'
                            : 'border-slate-200 bg-white hover:border-primary hover:bg-blue-50'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-primary">
                              {user.name || 'Без имени'}
                            </p>
                            <p className="text-xs text-slate-500">
                              {user.username ? `@${user.username}` : 'Без ника'} · Телеграм ID:{' '}
                              {user.telegramId || 'не указан'}
                            </p>
                          </div>
                          <span className="px-2 py-1 text-xs font-semibold text-white bg-primary rounded-full">
                            {roleLabels[user.role] ?? user.role}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-3 mt-3 text-xs text-slate-500">
                          <span>Команд: {user.teamsCount}</span>
                          <span>Игры: {user.gamesCount}</span>
                          <span>Обновлён {lastUpdateLabel}</span>
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <div className="p-6 text-sm text-center text-slate-500 bg-white border border-slate-200 rounded-2xl shadow-sm">
                Пользователи не найдены. Измените параметры фильтра или сбросьте поиск.
              </div>
            )}
          </div>

          <div className="md:col-span-3">
            {selectedUser ? (
              <div className="space-y-6">
                {!location && (
                  <div className="p-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-2xl">
                    Не удалось определить площадку пользователя. Сохранение изменений недоступно.
                  </div>
                )}

                {feedback && (
                  <div
                    className={`p-4 text-sm border rounded-2xl ${
                      feedback.type === 'success'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        : 'bg-rose-50 border-rose-200 text-rose-700'
                    }`}
                  >
                    {feedback.message}
                  </div>
                )}

                <section className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-6">
                  <div>
                    <h2 className="text-lg font-semibold text-primary">
                      {selectedUser.name || 'Без имени'}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      {selectedUser.username ? `@${selectedUser.username}` : 'Ник не указан'} · Telegram ID:{' '}
                      {selectedUser.telegramId || '—'}
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                      <p className="text-xs text-blue-600">Команд</p>
                      <p className="mt-1 text-xl font-semibold text-primary">{selectedUser.teamsCount}</p>
                    </div>
                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                      <p className="text-xs text-emerald-600">Игры</p>
                      <p className="mt-1 text-xl font-semibold text-emerald-700">{selectedUser.gamesCount}</p>
                    </div>
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                      <p className="text-xs text-slate-600">Последнее обновление</p>
                      <p className="mt-1 text-sm text-slate-700">
                        {selectedUser.updatedAt
                          ? formatRelativeTimeFromNow(selectedUser.updatedAt)
                          : 'Неизвестно'}
                      </p>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="user-role" className="text-sm font-semibold text-primary">
                      Роль в системе
                    </label>
                    <select
                      id="user-role"
                      value={selectedUser.role}
                      onChange={(event) => handleRoleChange(event.target.value)}
                      className="w-full px-4 py-3 mt-2 text-sm border rounded-xl border-slate-200 focus:border-primary focus:ring-1 focus:ring-primary"
                    >
                      {roleOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-3 md:flex-row md:items-center">
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={!location || !isDirty || isSaving}
                      className={`inline-flex justify-center px-5 py-3 text-sm font-semibold text-white rounded-xl transition ${
                        !location || !isDirty || isSaving
                          ? 'bg-slate-400 cursor-not-allowed'
                          : 'bg-primary hover:bg-blue-700'
                      }`}
                    >
                      {isSaving ? 'Сохранение…' : 'Сохранить изменения'}
                    </button>
                    <button
                      type="button"
                      onClick={handleReset}
                      disabled={!isDirty}
                      className={`inline-flex justify-center px-5 py-3 text-sm font-semibold rounded-xl border transition ${
                        !isDirty
                          ? 'border-slate-200 text-slate-400 cursor-not-allowed'
                          : 'border-primary text-primary hover:bg-blue-50'
                      }`}
                    >
                      Отменить
                    </button>
                  </div>
                </section>

                <section className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-4">
                  <h3 className="text-base font-semibold text-primary">Команды пользователя</h3>

                  {selectedUser.teams.length > 0 ? (
                    <ul className="space-y-3">
                      {selectedUser.teams.map((team) => (
                        <li
                          key={team.id}
                          className="p-4 border border-slate-200 rounded-2xl flex flex-col gap-2 md:flex-row md:items-center md:justify-between"
                        >
                          <div>
                            <p className="text-sm font-semibold text-primary">{team.name || 'Без названия'}</p>
                            <p className="text-xs text-slate-500">
                              {team.isCaptain ? 'Капитан' : 'Участник'} · Игр: {team.gamesCount}
                            </p>
                          </div>
                          <p className="text-xs text-slate-400">
                            {team.updatedAt
                              ? `Обновлено ${formatRelativeTimeFromNow(team.updatedAt)}`
                              : 'Дата обновления неизвестна'}
                          </p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-slate-500">
                      Пользователь ещё не вступил ни в одну команду.
                    </p>
                  )}
                </section>

                <section className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-4">
                  <h3 className="text-base font-semibold text-primary">Дополнительная информация</h3>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <p className="text-xs text-slate-500">Телефон</p>
                      <p className="mt-1 text-sm text-slate-700">
                        {selectedUser.phone || 'Не указан'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Создан</p>
                      <p className="mt-1 text-sm text-slate-700">
                        {selectedUser.createdAt
                          ? formatRelativeTimeFromNow(selectedUser.createdAt)
                          : 'Неизвестно'}
                      </p>
                    </div>
                  </div>

                  {selectedUser.preferences && selectedUser.preferences.length > 0 && (
                    <div>
                      <p className="text-xs text-slate-500">Предпочтения</p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {selectedUser.preferences.map((preference) => (
                          <span
                            key={preference}
                            className="px-3 py-1 text-xs font-medium text-primary bg-blue-50 border border-blue-200 rounded-full"
                          >
                            {preference}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedUser.about && (
                    <div>
                      <p className="text-xs text-slate-500">О себе</p>
                      <p className="mt-1 text-sm text-slate-700 whitespace-pre-line">
                        {selectedUser.about}
                      </p>
                    </div>
                  )}
                </section>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full p-6 bg-white border border-dashed border-slate-200 rounded-2xl">
                <p className="text-sm text-slate-500">Выберите пользователя из списка слева, чтобы просмотреть детали.</p>
              </div>
            )}
          </div>
        </section>
      </CabinetLayout>
    </>
  )
}

const userTeamShape = PropTypes.shape({
  id: PropTypes.string.isRequired,
  name: PropTypes.string,
  role: PropTypes.string,
  isCaptain: PropTypes.bool,
  gamesCount: PropTypes.number,
  updatedAt: PropTypes.string,
})

const userShape = PropTypes.shape({
  id: PropTypes.string.isRequired,
  telegramId: PropTypes.string,
  name: PropTypes.string,
  username: PropTypes.string,
  phone: PropTypes.string,
  role: PropTypes.string,
  about: PropTypes.string,
  preferences: PropTypes.arrayOf(PropTypes.string),
  createdAt: PropTypes.string,
  updatedAt: PropTypes.string,
  teams: PropTypes.arrayOf(userTeamShape),
  teamsCount: PropTypes.number,
  gamesCount: PropTypes.number,
})

ManageUsersPage.propTypes = {
  initialUsers: PropTypes.arrayOf(userShape),
  initialLocation: PropTypes.string,
  session: PropTypes.object,
}

ManageUsersPage.defaultProps = {
  initialUsers: [],
  initialLocation: null,
  session: null,
}

export async function getServerSideProps(context) {
  const session = await getSessionSafe(context)

  if (!session) {
    const callbackTarget = context.resolvedUrl || '/cabinet/admin/users'
    return {
      redirect: {
        destination: `/cabinet/login?callbackUrl=${encodeURIComponent(callbackTarget)}`,
        permanent: false,
      },
    }
  }

  if (!isUserAdmin({ role: session?.user?.role })) {
    return {
      redirect: {
        destination: '/cabinet',
        permanent: false,
      },
    }
  }

  const location = session?.user?.location ?? null
  let initialUsers = []

  if (location) {
    try {
      const db = await dbConnect(location)

      if (db) {
        const UsersModel = db.model('Users')
        const TeamsUsersModel = db.model('TeamsUsers')
        const TeamsModel = db.model('Teams')
        const GamesTeamsModel = db.model('GamesTeams')

        const usersDocs = await UsersModel.find({}).sort({ name: 1 }).lean()
        const membershipsDocs = await TeamsUsersModel.find({})
          .select({ teamId: 1, userTelegramId: 1, role: 1 })
          .lean()

        const teamIds = Array.from(
          new Set(
            membershipsDocs
              .map((doc) => toStringId(doc?.teamId))
              .filter((teamId) => typeof teamId === 'string' && teamId.length > 0)
          )
        )

        const teamsDocs = teamIds.length
          ? await TeamsModel.find({ _id: { $in: teamIds } })
              .select({ _id: 1, name: 1, updatedAt: 1 })
              .lean()
          : []

        const gamesTeamsDocs = teamIds.length
          ? await GamesTeamsModel.find({ teamId: { $in: teamIds } })
              .select({ teamId: 1, gameId: 1 })
              .lean()
          : []

        const teamsMap = teamsDocs.reduce((acc, team) => {
          const id = toStringId(team?._id)
          if (id) {
            acc[id] = {
              id,
              name: typeof team?.name === 'string' ? team.name : '',
              updatedAt: team?.updatedAt ?? null,
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

        const gamesIdsByTeamSet = gamesTeamsDocs.reduce((acc, doc) => {
          const teamId = toStringId(doc?.teamId)
          const gameId = toStringId(doc?.gameId)

          if (!teamId || !gameId) {
            return acc
          }

          if (!acc[teamId]) {
            acc[teamId] = new Set()
          }

          acc[teamId].add(gameId)
          return acc
        }, {})

        const gamesIdsByTeam = Object.entries(gamesIdsByTeamSet).reduce((acc, [teamId, ids]) => {
          acc[teamId] = Array.from(ids)
          return acc
        }, {})

        initialUsers = usersDocs
          .map((userDoc) =>
            normalizeUserForAdmin({
              userDoc,
              membershipsByUser,
              teamsMap,
              gamesIdsByTeam,
            })
          )
          .sort((a, b) => a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' }))
      }
    } catch (error) {
      console.error('Failed to load users for admin cabinet', error)
    }
  }

  return {
    props: {
      session,
      initialUsers,
      initialLocation: location,
    },
  }
}

export default ManageUsersPage
