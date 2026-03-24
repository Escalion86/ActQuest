import { useCallback, useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useSession } from 'next-auth/react'

import CabinetLayout from '@components/cabinet/CabinetLayout'
import CabinetButton from '@components/cabinet/CabinetButton'
import CabinetInputField from '@components/cabinet/CabinetInputField'
import CabinetSelectField from '@components/cabinet/CabinetSelectField'
import FormSectionCard from '@components/cabinet/FormSectionCard'
import SelectableCard from '@components/cabinet/SelectableCard'
import CardActionIconButton, { EditCardIcon } from '@components/cabinet/CardActionIconButton'
import NoticeBanner from '@components/NoticeBanner'
import Modal from '@components/Modal'
import formatRelativeTimeFromNow from '@helpers/formatRelativeTimeFromNow'
import getSessionSafe from '@helpers/getSessionSafe'
import isUserAdmin from '@helpers/isUserAdmin'
import normalizeUserProfile from '@helpers/normalizeUserProfile'
import fetchAdminUsersForCabinet from '@helpers/fetchAdminUsersForCabinet'
import useCabinetRolePreview from '@helpers/useCabinetRolePreview'
import { USERS_ROLES } from '@helpers/constants'
import dbConnectGlobal from '@utils/dbConnectGlobal'

const USERS_PAGE_SIZE = 10
const modalSectionTitleClass = 'aq-modal-section-title text-base font-semibold'
const modalItemTitleClass = 'aq-modal-item-title text-lg font-semibold'
const modalItemSmallTitleClass = 'aq-modal-item-title text-sm font-semibold'

const roleLabels = {
  client: 'Пользователь',
  moder: 'Модератор',
  admin: 'Администратор',
  dev: 'Разработчик',
  ban: 'Заблокирован',
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

const ManageUsersPage = ({
  initialUsers,
  initialHasMore,
  initialLocation,
  session: initialSession,
}) => {
  const safeInitialUsers = Array.isArray(initialUsers) ? initialUsers : []
  const router = useRouter()
  const { data: session } = useSession()
  const activeSession = session ?? initialSession ?? null
  const location = activeSession?.user?.location ?? initialLocation ?? null
  const { effectiveRole } = useCabinetRolePreview(
    activeSession?.user?.role ?? 'client',
  )
  const isAdmin = isUserAdmin({ role: effectiveRole })

  const [users, setUsers] = useState(safeInitialUsers)
  const [persistedUsers, setPersistedUsers] = useState(safeInitialUsers)
  const [selectedUserId, setSelectedUserId] = useState(safeInitialUsers[0]?.id ?? null)
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [feedback, setFeedback] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [hasMoreUsers, setHasMoreUsers] = useState(Boolean(initialHasMore))
  const [isLoadingMoreUsers, setIsLoadingMoreUsers] = useState(false)
  const [isRequestingPhone, setIsRequestingPhone] = useState(false)
  const [isUserEditModalOpen, setIsUserEditModalOpen] = useState(false)

  useEffect(() => {
    setUsers(safeInitialUsers)
    setPersistedUsers(safeInitialUsers)
    setHasMoreUsers(Boolean(initialHasMore))
    setSelectedUserId((prev) => {
      if (prev && safeInitialUsers.some((user) => user.id === prev)) {
        return prev
      }

      return safeInitialUsers[0]?.id ?? null
    })
  }, [initialHasMore, safeInitialUsers])

  const setUserIdQuery = useCallback(
    (nextUserId) => {
      if (!router.isReady) {
        return
      }

      const nextQuery = { ...router.query }
      if (nextUserId) {
        nextQuery.userId = nextUserId
      } else {
        delete nextQuery.userId
      }

      router
        .replace(
          {
            pathname: router.pathname,
            query: nextQuery,
          },
          undefined,
          { shallow: true, scroll: false }
        )
        .catch(() => {})
    },
    [router]
  )

  const closeUserEditModal = useCallback(() => {
    setIsUserEditModalOpen(false)
    setUserIdQuery(null)
  }, [setUserIdQuery])

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
      setIsUserEditModalOpen(false)
      setUserIdQuery(null)
      return
    }

    setSelectedUserId((prev) => {
      if (prev && filteredUsers.some((user) => user.id === prev)) {
        return prev
      }

      return filteredUsers[0]?.id ?? null
    })
  }, [filteredUsers, setUserIdQuery])

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

  const handleUserCardClick = useCallback(
    (user) => {
      if (!user) {
        return
      }

      setSelectedUserId(user.id)
      setIsUserEditModalOpen(true)
      setUserIdQuery(user.id)
    },
    [setUserIdQuery]
  )

  useEffect(() => {
    if (!router.isReady) {
      return
    }

    const rawUserId = router.query?.userId
    const userIdFromQuery = Array.isArray(rawUserId) ? rawUserId[0] : rawUserId

    if (!userIdFromQuery || typeof userIdFromQuery !== 'string') {
      setIsUserEditModalOpen(false)
      return
    }

    const exists = users.some((user) => user.id === userIdFromQuery)
    if (!exists) {
      setIsUserEditModalOpen(false)
      return
    }

    setSelectedUserId(userIdFromQuery)
    setIsUserEditModalOpen(true)
  }, [router.isReady, router.query?.userId, users])

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

  const handleRequestPhoneViaTelegram = useCallback(async () => {
    if (!selectedUser || !location || isRequestingPhone) {
      return
    }

    if (!selectedUser.telegramId) {
      setFeedback({
        type: 'error',
        message: 'У выбранного пользователя не указан Telegram ID',
      })
      return
    }

    setIsRequestingPhone(true)
    setFeedback(null)

    try {
      const response = await fetch('/api/cabinet/users/request-phone', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: selectedUser.globalUserId || selectedUser.id,
        }),
      })

      const json = await response.json().catch(() => null)

      if (!response.ok || !json?.success) {
        throw new Error(
          (json && (json.error || json.message)) ||
            'Не удалось отправить запрос номера через Telegram',
        )
      }

      setFeedback({
        type: 'success',
        message:
          'Запрос номера отправлен пользователю в Telegram. Ожидаем отправку контакта.',
      })
    } catch (error) {
      console.error('Failed to request phone via Telegram', error)
      setFeedback({
        type: 'error',
        message:
          error?.message ||
          'Не удалось отправить запрос номера через Telegram',
      })
    } finally {
      setIsRequestingPhone(false)
    }
  }, [isRequestingPhone, location, selectedUser])

  const handleLoadMoreUsers = useCallback(async () => {
    if (isLoadingMoreUsers || !hasMoreUsers) {
      return
    }

    setIsLoadingMoreUsers(true)
    setFeedback(null)

    try {
      const params = new URLSearchParams({
        offset: String(users.length),
        limit: String(USERS_PAGE_SIZE),
      })
      const response = await fetch(`/api/cabinet/admin/users-list?${params.toString()}`)
      const json = await response.json()

      if (!response.ok || json?.success === false) {
        throw new Error(json?.error || 'Не удалось загрузить пользователей')
      }

      const nextUsers = Array.isArray(json?.data) ? json.data : []
      const nextHasMore = Boolean(json?.meta?.hasMore)

      if (nextUsers.length > 0) {
        setUsers((prevUsers) => [...prevUsers, ...nextUsers])
        setPersistedUsers((prevUsers) => [...prevUsers, ...nextUsers])
      }

      setHasMoreUsers(nextHasMore)
    } catch (error) {
      console.error('Failed to load more users', error)
      setFeedback({
        type: 'error',
        message: error?.message || 'Не удалось загрузить дополнительных пользователей',
      })
    } finally {
      setIsLoadingMoreUsers(false)
    }
  }, [hasMoreUsers, isLoadingMoreUsers, users.length])

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
          <FormSectionCard>
            <p className="text-sm text-slate-600 dark:text-slate-200">
              У вас нет доступа к управлению пользователями. Если вы считаете, что это ошибка, обратитесь к
              главному организатору.
            </p>
          </FormSectionCard>
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
          <div className="md:col-span-5 space-y-4">
            <FormSectionCard className="p-4">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                Все пользователи
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Загружено: {users.length}. Выберите участника, чтобы просмотреть детали и обновить его роль.
              </p>
            </FormSectionCard>

            <FormSectionCard className="p-4 space-y-3">
              <CabinetInputField
                id="user-search"
                label="Поиск"
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Введите имя, ник или Telegram ID"
                containerClassName="space-y-1"
                labelClassName="text-xs font-semibold text-slate-500"
                inputClassName="w-full px-3 py-2 text-sm border rounded-xl border-slate-200 dark:border-slate-700 focus:border-primary focus:ring-1 focus:ring-primary"
              />

              <CabinetSelectField
                  id="user-role-filter"
                  label="Роль"
                  value={roleFilter}
                  onChange={(event) => setRoleFilter(event.target.value)}
                  containerClassName="space-y-1"
                  labelClassName="text-xs font-semibold text-slate-500"
                  selectClassName="w-full px-3 py-2 text-sm border rounded-xl border-slate-200 dark:border-slate-700 focus:border-primary focus:ring-1 focus:ring-primary"
                >
                  {filterOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.name}
                    </option>
                  ))}
              </CabinetSelectField>
            </FormSectionCard>

            {filteredUsers.length > 0 ? (
              <div className="space-y-3">
                <ul className="space-y-3">
                  {filteredUsers.map((user) => {
                    const isActive = user.id === selectedUserId
                    const lastUpdateLabel = user.updatedAt
                      ? formatRelativeTimeFromNow(user.updatedAt)
                      : '—'

                    return (
                      <li key={user.id}>
                        <SelectableCard
                          as="button"
                          onClick={() => handleUserCardClick(user)}
                          type="button"
                          isActive={isActive}
                          className="w-full text-left"
                          aria-pressed={isActive}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                                {user.name || 'Без имени'}
                              </p>
                              <p className="text-xs text-slate-500">
                                {user.username ? `@${user.username}` : 'Без ника'} · Телеграм ID:{' '}
                                {user.telegramId || 'не указан'}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-1 text-xs font-semibold text-white bg-primary rounded-full">
                                {roleLabels[user.role] ?? user.role}
                              </span>
                              <CardActionIconButton
                                as="span"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  handleUserCardClick(user)
                                }}
                                label="Редактировать пользователя"
                              >
                                <EditCardIcon />
                              </CardActionIconButton>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-3 mt-3 text-xs text-slate-500">
                            <span>Команд: {user.teamsCount}</span>
                            <span>Игры: {user.gamesCount}</span>
                            <span>Обновлён {lastUpdateLabel}</span>
                          </div>
                        </SelectableCard>
                      </li>
                    )
                  })}
                </ul>
                {hasMoreUsers && (
                  <CabinetButton
                    onClick={handleLoadMoreUsers}
                    disabled={isLoadingMoreUsers}
                    variant="secondary"
                    tone={isLoadingMoreUsers ? 'neutral' : 'cyan'}
                    size="md"
                    className={`w-full ${
                      isLoadingMoreUsers
                        ? 'cursor-wait'
                        : 'cursor-pointer'
                    }`}
                  >
                    {isLoadingMoreUsers ? 'Загружаем…' : 'Загрузить ещё'}
                  </CabinetButton>
                )}
              </div>
            ) : (
              <FormSectionCard className="p-6 text-sm text-center text-slate-500 dark:text-slate-300">
                Пользователи не найдены. Измените параметры фильтра или сбросьте поиск.
              </FormSectionCard>
            )}
          </div>

        </section>
        <Modal
          isOpen={isUserEditModalOpen && Boolean(selectedUser)}
          onClose={closeUserEditModal}
          title={`Пользователь — ${selectedUser?.name || 'Без имени'}`}
        >
          {selectedUser ? (
            <div className="space-y-6">
              {!location && (
                <NoticeBanner tone="warning" variant="neon">
                  Не удалось определить площадку пользователя. Сохранение изменений недоступно.
                </NoticeBanner>
              )}

              {feedback && (
                <NoticeBanner
                  tone={feedback.type === 'success' ? 'success' : 'error'}
                  variant="neon"
                >
                  {feedback.message}
                </NoticeBanner>
              )}

              <FormSectionCard className="space-y-6">
                <div>
                  <h2 className={modalItemTitleClass}>
                    {selectedUser.name || 'Без имени'}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {selectedUser.username ? `@${selectedUser.username}` : 'Ник не указан'} · Telegram ID:{' '}
                    {selectedUser.telegramId || '—'}
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl dark:bg-sky-500/10 dark:border-sky-500/30">
                    <p className="text-xs text-blue-600 dark:text-sky-300">Команд</p>
                    <p className="mt-1 text-xl font-semibold text-primary dark:text-sky-100">{selectedUser.teamsCount}</p>
                  </div>
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl dark:bg-emerald-500/10 dark:border-emerald-500/30">
                    <p className="text-xs text-emerald-600 dark:text-emerald-300">Игры</p>
                    <p className="mt-1 text-xl font-semibold text-emerald-700 dark:text-emerald-100">{selectedUser.gamesCount}</p>
                  </div>
                  <div className="p-4 bg-slate-50 border border-slate-200 dark:bg-slate-800/70 dark:border-slate-700 rounded-xl">
                    <p className="text-xs text-slate-600 dark:text-slate-300">Последнее обновление</p>
                    <p className="mt-1 text-sm text-slate-700 dark:text-slate-100">
                      {selectedUser.updatedAt
                        ? formatRelativeTimeFromNow(selectedUser.updatedAt)
                        : 'Неизвестно'}
                    </p>
                  </div>
                </div>

                <CabinetSelectField
                    id="user-role"
                    label="Роль в системе"
                    value={selectedUser.role}
                    onChange={(event) => handleRoleChange(event.target.value)}
                    labelClassName={modalItemSmallTitleClass}
                    selectClassName="w-full px-4 py-3 text-sm border rounded-xl border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100 focus:border-primary focus:ring-1 focus:ring-primary"
                  >
                    {roleOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.name}
                      </option>
                    ))}
                </CabinetSelectField>

                <div className="flex flex-col gap-3 md:flex-row md:items-center">
                  <CabinetButton
                    onClick={handleSave}
                    disabled={!location || !isDirty || isSaving}
                    variant="primary"
                    className={isSaving ? 'cursor-wait' : ''}
                  >
                    {isSaving ? 'Сохранение…' : 'Сохранить изменения'}
                  </CabinetButton>
                  <CabinetButton
                    onClick={handleReset}
                    disabled={!isDirty}
                    variant="secondary"
                    tone="brand"
                  >
                    Отменить
                  </CabinetButton>
                  <CabinetButton
                    onClick={handleRequestPhoneViaTelegram}
                    disabled={
                      !location ||
                      !selectedUser.telegramId ||
                      isRequestingPhone
                    }
                    variant="secondary"
                    tone="success"
                    className={isRequestingPhone ? 'cursor-wait' : ''}
                  >
                    {isRequestingPhone
                      ? 'Отправка...'
                      : 'Запросить номер телефона через Telegram'}
                  </CabinetButton>
                </div>
              </FormSectionCard>

              <FormSectionCard className="space-y-4">
                <h3 className={modalSectionTitleClass}>Команды пользователя</h3>

                {selectedUser.teams.length > 0 ? (
                  <ul className="space-y-3">
                    {selectedUser.teams.map((team) => (
                      <li
                        key={team.id}
                        className="p-4 border border-slate-200 dark:border-slate-700 rounded-2xl flex flex-col gap-2 md:flex-row md:items-center md:justify-between"
                      >
                        <div>
                          <p className={modalItemSmallTitleClass}>{team.name || 'Без названия'}</p>
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
              </FormSectionCard>

              <FormSectionCard className="space-y-4">
                <h3 className={modalSectionTitleClass}>Дополнительная информация</h3>

                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <p className="text-xs text-slate-500">Телефон</p>
                    <p className="mt-1 text-sm text-slate-700 dark:text-slate-100">
                      {selectedUser.phone || 'Не указан'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Создан</p>
                    <p className="mt-1 text-sm text-slate-700 dark:text-slate-100">
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
                          className="px-3 py-1 text-xs font-medium text-primary bg-blue-50 border border-blue-200 rounded-full dark:bg-sky-500/10 dark:border-sky-500/30 dark:text-sky-200"
                        >
                          {preference}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <p className="text-xs text-slate-500">О себе</p>
                  <p className="mt-1 text-sm text-slate-500 whitespace-pre-line">
                    {selectedUser.about?.trim() || 'Пользователь пока не добавил описание профиля.'}
                  </p>
                </div>
              </FormSectionCard>
            </div>
          ) : null}
        </Modal>
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
  globalUserId: PropTypes.string,
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
  initialHasMore: PropTypes.bool,
  initialLocation: PropTypes.string,
  session: PropTypes.object,
}

ManageUsersPage.defaultProps = {
  initialUsers: [],
  initialHasMore: false,
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
  let initialHasMore = false

  if (location) {
    try {
      const db = await dbConnectGlobal()

      if (db) {
        const result = await fetchAdminUsersForCabinet({
          db,
          offset: 0,
          limit: USERS_PAGE_SIZE,
        })
        initialUsers = Array.isArray(result)
          ? result
          : Array.isArray(result?.users)
            ? result.users
            : []
        initialHasMore = Array.isArray(result)
          ? result.length === USERS_PAGE_SIZE
          : Boolean(result?.hasMore)
      }
    } catch (error) {
      console.error('Failed to load users for admin cabinet', error)
    }
  }

  return {
    props: {
      session,
      initialUsers,
      initialHasMore,
      initialLocation: location,
    },
  }
}

export default ManageUsersPage
