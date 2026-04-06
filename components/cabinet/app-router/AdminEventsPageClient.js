'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import CabinetLayout from '@components/cabinet/CabinetLayout'
import CabinetButton from '@components/cabinet/CabinetButton'
import FormSectionCard from '@components/cabinet/FormSectionCard'
import TeamMemberCard from '@components/cabinet/cards/TeamMemberCard'
import UserTeamCard from '@components/cabinet/cards/UserTeamCard'
import Modal from '@components/Modal'
import TeamDescriptionModal from '@components/modals/TeamDescriptionModal'
import NoticeBanner from '@components/NoticeBanner'
import getUserAvatarSrc from '@helpers/getUserAvatarSrc'
import fetchCabinetGameDetails from '@helpers/fetchCabinetGameDetails'
import fetchCabinetUserDetails from '@helpers/fetchCabinetUserDetails'
import requestApiJson from '@helpers/requestApiJson'
import isUserAdmin from '@helpers/isUserAdmin'
import useCabinetRolePreview from '@helpers/useCabinetRolePreview'
import useMergedSession from '@helpers/useMergedSession'
import { LOCATIONS } from '@server/serverConstants'

const EVENTS_PAGE_SIZE = 20
const CABINET_ADMIN_API_BASE = '/api/cabinet/admin'

const EVENT_TYPE_LABELS = {
  user_registered: 'Регистрация пользователя',
  team_created: 'Создание команды',
  team_deleted: 'Удаление команды',
  team_registered_to_game: 'Регистрация команды на игру',
  team_unregistered_from_game: 'Снятие команды с игры',
}

const USER_REGISTERED_EVENT = 'user_registered'
const TEAM_CREATED_EVENT = 'team_created'
const TEAM_DELETED_EVENT = 'team_deleted'
const TEAM_REGISTERED_TO_GAME_EVENT = 'team_registered_to_game'
const TEAM_UNREGISTERED_FROM_GAME_EVENT = 'team_unregistered_from_game'
const MONGO_OBJECT_ID_REGEXP = /^[0-9a-fA-F]{24}$/

const resolveLocationLabel = (locationKey) => {
  if (typeof locationKey !== 'string' || !locationKey.trim()) {
    return 'Не указан'
  }

  const normalized = locationKey.trim().toLowerCase()
  const townRu = LOCATIONS?.[normalized]?.townRu
  if (typeof townRu !== 'string' || !townRu.trim()) {
    return locationKey
  }

  return townRu.charAt(0).toUpperCase() + townRu.slice(1)
}

const formatDateTime = (value) => {
  const date = value ? new Date(value) : null
  if (!date || Number.isNaN(date.getTime())) {
    return 'Дата неизвестна'
  }
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date)
}

const normalizeEvent = (event) => ({
  id: typeof event?.id === 'string' ? event.id : '',
  type: typeof event?.type === 'string' ? event.type : '',
  location: typeof event?.location === 'string' ? event.location : null,
  message: typeof event?.message === 'string' ? event.message : '',
  actorUserId:
    typeof event?.actorUserId === 'string' ? event.actorUserId : null,
  actorTelegramId: Number.isFinite(event?.actorTelegramId)
    ? Number(event.actorTelegramId)
    : null,
  targetUserId:
    typeof event?.targetUserId === 'string' ? event.targetUserId : null,
  teamId: typeof event?.teamId === 'string' ? event.teamId : null,
  teamName: typeof event?.teamName === 'string' ? event.teamName : '',
  gameId: typeof event?.gameId === 'string' ? event.gameId : null,
  gameName: typeof event?.gameName === 'string' ? event.gameName : '',
  createdAt: typeof event?.createdAt === 'string' ? event.createdAt : null,
})

const hasOwn = (obj, key) =>
  Boolean(obj) && Object.prototype.hasOwnProperty.call(obj, key)

const AdminEventsPageClient = ({
  initialEvents,
  initialHasMore,
  session: initialSession,
}) => {
  const { activeSession } = useMergedSession(initialSession)
  const { effectiveRole } = useCabinetRolePreview(
    activeSession?.user?.role ?? 'client',
  )
  const isAdmin = isUserAdmin({ role: effectiveRole })

  const [events, setEvents] = useState(
    Array.isArray(initialEvents)
      ? initialEvents.map((event) => normalizeEvent(event))
      : [],
  )
  const [hasMore, setHasMore] = useState(Boolean(initialHasMore))
  const [locationFilters, setLocationFilters] = useState([])
  const [isLocationFilterPanelOpen, setIsLocationFilterPanelOpen] =
    useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [userDetailsById, setUserDetailsById] = useState({})
  const [teamDetailsById, setTeamDetailsById] = useState({})
  const [gameDetailsById, setGameDetailsById] = useState({})
  const [isUserModalOpen, setIsUserModalOpen] = useState(false)
  const [isUserModalLoading, setIsUserModalLoading] = useState(false)
  const [selectedUserForModal, setSelectedUserForModal] = useState(null)
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false)
  const [selectedTeamForModal, setSelectedTeamForModal] = useState(null)

  const locationOptions = useMemo(
    () =>
      Object.entries(LOCATIONS)
        .filter(([, value]) => !value?.hidden)
        .map(([key, value]) => ({
          value: key,
          label:
            typeof value?.townRu === 'string' && value.townRu.length > 0
              ? value.townRu.charAt(0).toUpperCase() + value.townRu.slice(1)
              : key,
        })),
    [],
  )

  const locationFilterLabel = useMemo(() => {
    if (!Array.isArray(locationFilters) || locationFilters.length === 0) {
      return 'Город'
    }
    if (locationFilters.length === 1) {
      const selected = locationOptions.find(
        (option) => option.value === locationFilters[0],
      )
      return selected?.label || 'Город'
    }
    return `Города: ${locationFilters.length}`
  }, [locationFilters, locationOptions])

  const buildQuery = useCallback((offset, limit, nextLocationFilters) => {
    const params = new URLSearchParams({
      offset: String(offset),
      limit: String(limit),
    })
    if (Array.isArray(nextLocationFilters) && nextLocationFilters.length > 0) {
      params.set('locations', nextLocationFilters.join(','))
    }
    return params.toString()
  }, [])

  const fetchTeamDetailsForEvents = useCallback(
    async (teamId) => {
      const endpointBase = isAdmin
        ? '/api/cabinet/admin/team-details'
        : '/api/cabinet/team-details'
      const { json } = await requestApiJson(
        `${endpointBase}?${new URLSearchParams({ teamId }).toString()}`,
        { fallbackMessage: 'Не удалось загрузить команду' },
      )
      return json?.data && typeof json.data === 'object' ? json.data : null
    },
    [isAdmin],
  )

  const loadEvents = useCallback(
    async (nextLocationFilters) => {
      setIsLoading(true)
      setFeedback(null)
      try {
        const query = buildQuery(0, EVENTS_PAGE_SIZE, nextLocationFilters)
        const { json } = await requestApiJson(
          `${CABINET_ADMIN_API_BASE}/events-list?${query}`,
          { fallbackMessage: 'Не удалось загрузить список событий' },
        )
        const nextEvents = Array.isArray(json?.data)
          ? json.data.map((event) => normalizeEvent(event))
          : []
        setEvents(nextEvents)
        setHasMore(Boolean(json?.meta?.hasMore))
      } catch (error) {
        setFeedback({
          type: 'error',
          message: error?.message || 'Не удалось загрузить список событий',
        })
      } finally {
        setIsLoading(false)
      }
    },
    [buildQuery],
  )

  const handleToggleLocationFilter = useCallback(
    (locationValue) => {
      const normalizedLocation =
        typeof locationValue === 'string'
          ? locationValue.trim().toLowerCase()
          : ''
      if (!normalizedLocation) {
        return
      }

      const nextLocationFilters = Array.from(
        new Set(
          locationFilters.includes(normalizedLocation)
            ? locationFilters.filter((item) => item !== normalizedLocation)
            : [...locationFilters, normalizedLocation],
        ),
      )

      setLocationFilters(nextLocationFilters)
    },
    [locationFilters],
  )

  const handleResetLocationFilters = useCallback(() => {
    setLocationFilters([])
  }, [])

  const handleLoadMore = useCallback(async () => {
    setIsLoadingMore(true)
    setFeedback(null)
    try {
      const query = buildQuery(events.length, EVENTS_PAGE_SIZE, locationFilters)
      const { json } = await requestApiJson(
        `${CABINET_ADMIN_API_BASE}/events-list?${query}`,
        { fallbackMessage: 'Не удалось загрузить список событий' },
      )
      const nextEvents = Array.isArray(json?.data)
        ? json.data.map((event) => normalizeEvent(event))
        : []
      setEvents((prev) => [...prev, ...nextEvents])
      setHasMore(Boolean(json?.meta?.hasMore))
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error?.message || 'Не удалось загрузить список событий',
      })
    } finally {
      setIsLoadingMore(false)
    }
  }, [buildQuery, events.length, locationFilters])

  useEffect(() => {
    void loadEvents(locationFilters)
  }, [loadEvents, locationFilters])

  useEffect(() => {
    if (!Array.isArray(events) || events.length === 0) {
      return
    }

    const userIdsToLoad = new Set()
    const teamIdsToLoad = new Set()
    const gamesToLoad = []

    const invalidTeamIds = new Set()

    events.forEach((event) => {
      const eventType = String(event?.type || '')
        .trim()
        .toLowerCase()
      if (eventType === USER_REGISTERED_EVENT) {
        const userId = String(
          event?.targetUserId || event?.actorUserId || '',
        ).trim()
        if (userId && !hasOwn(userDetailsById, userId)) {
          userIdsToLoad.add(userId)
        }
      }
      if (
        eventType === TEAM_CREATED_EVENT ||
        eventType === TEAM_DELETED_EVENT
      ) {
        const actorUserId = String(event?.actorUserId || '').trim()
        if (actorUserId && !hasOwn(userDetailsById, actorUserId)) {
          userIdsToLoad.add(actorUserId)
        }
      }
      if (
        eventType === TEAM_CREATED_EVENT ||
        eventType === TEAM_DELETED_EVENT ||
        eventType === TEAM_REGISTERED_TO_GAME_EVENT ||
        eventType === TEAM_UNREGISTERED_FROM_GAME_EVENT
      ) {
        const teamId = String(event?.teamId || '').trim()
        if (teamId && !hasOwn(teamDetailsById, teamId)) {
          if (MONGO_OBJECT_ID_REGEXP.test(teamId)) {
            teamIdsToLoad.add(teamId)
          } else {
            invalidTeamIds.add(teamId)
          }
        }
      }
      if (
        eventType === TEAM_REGISTERED_TO_GAME_EVENT ||
        eventType === TEAM_UNREGISTERED_FROM_GAME_EVENT
      ) {
        const gameId = String(event?.gameId || '').trim()
        if (gameId && !hasOwn(gameDetailsById, gameId)) {
          gamesToLoad.push({
            gameId,
            location:
              typeof event?.location === 'string' ? event.location : null,
          })
        }
      }
    })

    if (invalidTeamIds.size > 0) {
      setTeamDetailsById((prev) => {
        let hasChanges = false
        const next = { ...prev }
        invalidTeamIds.forEach((teamId) => {
          if (!hasOwn(next, teamId)) {
            next[teamId] = null
            hasChanges = true
          }
        })
        return hasChanges ? next : prev
      })
    }

    if (userIdsToLoad.size > 0) {
      Promise.all(
        Array.from(userIdsToLoad).map(async (userId) => {
          try {
            const user = await fetchCabinetUserDetails({ userId })
            return [userId, user]
          } catch (_error) {
            return [userId, null]
          }
        }),
      ).then((entries) => {
        setUserDetailsById((prev) => {
          let hasChanges = false
          const next = { ...prev }
          entries.forEach(([userId, user]) => {
            if (!hasOwn(next, userId)) {
              next[userId] = user || null
              hasChanges = true
            }
          })
          return hasChanges ? next : prev
        })
      })
    }

    if (teamIdsToLoad.size > 0) {
      Promise.all(
        Array.from(teamIdsToLoad).map(async (teamId) => {
          try {
            const team = await fetchTeamDetailsForEvents(teamId)
            return [teamId, team]
          } catch (_error) {
            return [teamId, null]
          }
        }),
      ).then((entries) => {
        setTeamDetailsById((prev) => {
          let hasChanges = false
          const next = { ...prev }
          entries.forEach(([teamId, team]) => {
            if (!hasOwn(next, teamId)) {
              next[teamId] = team || null
              hasChanges = true
            }
          })
          return hasChanges ? next : prev
        })
      })
    }

    if (gamesToLoad.length > 0) {
      Promise.all(
        gamesToLoad.map(async ({ gameId, location }) => {
          try {
            const game = await fetchCabinetGameDetails({ gameId, location })
            return [gameId, game]
          } catch (_error) {
            return [gameId, null]
          }
        }),
      ).then((entries) => {
        setGameDetailsById((prev) => {
          let hasChanges = false
          const next = { ...prev }
          entries.forEach(([gameId, game]) => {
            if (!hasOwn(next, gameId)) {
              next[gameId] = game || null
              hasChanges = true
            }
          })
          return hasChanges ? next : prev
        })
      })
    }
  }, [
    events,
    fetchTeamDetailsForEvents,
    gameDetailsById,
    teamDetailsById,
    userDetailsById,
  ])

  const handleOpenUserCard = useCallback(
    async (member) => {
      const userId = typeof member?.id === 'string' ? member.id.trim() : ''
      if (!userId) {
        return
      }

      setIsUserModalOpen(true)
      setIsUserModalLoading(true)

      const cachedUser = userDetailsById[userId]
      if (cachedUser) {
        setSelectedUserForModal(cachedUser)
        setIsUserModalLoading(false)
        return
      }

      try {
        const fetchedUser = await fetchCabinetUserDetails({ userId })
        if (fetchedUser) {
          setUserDetailsById((prev) => ({
            ...prev,
            [userId]: fetchedUser,
          }))
          setSelectedUserForModal(fetchedUser)
        } else {
          setFeedback({
            type: 'error',
            message: 'Не удалось загрузить данные пользователя',
          })
        }
      } catch (error) {
        setFeedback({
          type: 'error',
          message: error?.message || 'Не удалось загрузить данные пользователя',
        })
      } finally {
        setIsUserModalLoading(false)
      }
    },
    [userDetailsById],
  )

  const handleOpenTeamCard = useCallback(
    (team) => {
      if (!team || typeof team.id !== 'string' || !team.id.trim()) {
        return
      }
      const detailedTeam = teamDetailsById[team.id] || null
      if (detailedTeam) {
        setSelectedTeamForModal(detailedTeam)
        setIsTeamModalOpen(true)
      }
    },
    [teamDetailsById],
  )

  const closeTeamModal = useCallback(() => {
    setIsTeamModalOpen(false)
    setSelectedTeamForModal(null)
  }, [])

  const closeUserModal = useCallback(() => {
    setIsUserModalOpen(false)
    setIsUserModalLoading(false)
    setSelectedUserForModal(null)
  }, [])

  if (!isAdmin) {
    return (
      <CabinetLayout
        title="События сайта"
        description="Доступ ограничен: административные права отсутствуют."
        activePage="admin"
      >
        <NoticeBanner tone="warning">
          У вас нет прав для просмотра событий сайта.
        </NoticeBanner>
      </CabinetLayout>
    )
  }

  return (
    <CabinetLayout
      title="События сайта"
      description="Хронология ключевых действий пользователей и команд."
      activePage="admin"
    >
      <FormSectionCard className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsLocationFilterPanelOpen((prev) => !prev)}
            className={`inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold transition ${
              isLocationFilterPanelOpen
                ? 'bg-primary text-white'
                : 'border border-slate-200 bg-slate-100/90 text-slate-700 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:bg-slate-800'
            }`}
            aria-expanded={isLocationFilterPanelOpen}
            aria-controls="admin-events-city-filter-panel"
          >
            {locationFilterLabel}
          </button>
        </div>

        {isLocationFilterPanelOpen && (
          <div
            id="admin-events-city-filter-panel"
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-primary dark:text-slate-100">
                Город
              </p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => void handleResetLocationFilters()}
                  className="text-sm font-semibold text-rose-500 transition hover:text-rose-400"
                >
                  Сбросить
                </button>
                <button
                  type="button"
                  onClick={() => setIsLocationFilterPanelOpen(false)}
                  className="text-sm font-semibold text-rose-500 transition hover:text-rose-400"
                >
                  Скрыть
                </button>
              </div>
            </div>
            <div className="mt-3 max-h-64 space-y-1 overflow-y-auto pr-1">
              {locationOptions.map((option) => {
                const isSelected = locationFilters.includes(option.value)
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() =>
                      void handleToggleLocationFilter(option.value)
                    }
                    className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800/70"
                  >
                    <span
                      className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border text-xs font-bold ${
                        isSelected
                          ? 'border-primary bg-primary text-white'
                          : 'border-slate-400 bg-transparent text-transparent dark:border-slate-500'
                      }`}
                      aria-hidden="true"
                    >
                      ✓
                    </span>
                    <span>{option.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </FormSectionCard>

      {feedback?.message ? (
        <NoticeBanner tone={feedback.type === 'error' ? 'error' : 'info'}>
          {feedback.message}
        </NoticeBanner>
      ) : null}

      <section className="space-y-3">
        {events.length === 0 ? (
          <NoticeBanner tone="info">
            События не найдены. Попробуйте изменить фильтр.
          </NoticeBanner>
        ) : (
          events.map((event) => (
            <article
              key={event.id}
              className="rounded-2xl border border-slate-200 bg-white/85 p-4 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-900/80"
            >
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div className="font-semibold text-primary dark:text-slate-100">
                  {EVENT_TYPE_LABELS[event.type] || event.type || 'Событие'}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-300">
                  {formatDateTime(event.createdAt)}
                </div>
              </div>
              <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">
                {event.message || 'Без описания'}
              </p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-300">
                <span>Город: {resolveLocationLabel(event.location)}</span>
                {event.teamName ? <span>Команда: {event.teamName}</span> : null}
                {event.gameName ? <span>Игра: {event.gameName}</span> : null}
              </div>
              {String(event.type || '').toLowerCase() ===
              USER_REGISTERED_EVENT ? (
                <div className="mt-3">
                  {(() => {
                    const userId = String(
                      event.targetUserId || event.actorUserId || '',
                    ).trim()
                    const user = userId ? userDetailsById[userId] : null
                    const isResolved = userId
                      ? hasOwn(userDetailsById, userId)
                      : false
                    if (!isResolved) {
                      return (
                        <p className="text-xs text-slate-500 dark:text-slate-300">
                          Загрузка карточки пользователя...
                        </p>
                      )
                    }
                    if (!user) {
                      return (
                        <p className="text-xs text-slate-500 dark:text-slate-300">
                          Карточка пользователя недоступна.
                        </p>
                      )
                    }

                    return (
                      <TeamMemberCard
                        member={{
                          id: user.id || userId,
                          name: user.name || 'Без имени',
                          username: user.username || '',
                          userRole: user.role || 'client',
                          hasLinkedUser: true,
                          phone: user.phone || '',
                          isCaptain: false,
                        }}
                        onOpen={handleOpenUserCard}
                      />
                    )
                  })()}
                </div>
              ) : null}
              {[
                TEAM_CREATED_EVENT,
                TEAM_DELETED_EVENT,
                TEAM_REGISTERED_TO_GAME_EVENT,
                TEAM_UNREGISTERED_FROM_GAME_EVENT,
              ].includes(String(event.type || '').toLowerCase()) ? (
                <div className="mt-3 space-y-2">
                  {(() => {
                    const teamId = String(event.teamId || '').trim()
                    const team = teamId ? teamDetailsById[teamId] : null
                    const isResolved = teamId
                      ? hasOwn(teamDetailsById, teamId)
                      : false
                    const teamCard = !isResolved ? (
                      <p className="text-xs text-slate-500 dark:text-slate-300">
                        Загрузка карточки команды...
                      </p>
                    ) : team ? (
                      <UserTeamCard
                        team={{
                          id: team.id || teamId,
                          name: team.name || event.teamName || 'Без названия',
                          image: team.image || '',
                          isCaptain: false,
                          gamesCount: Number(team.gamesCount) || 0,
                        }}
                        onOpen={handleOpenTeamCard}
                        showCaptainBadge={false}
                      />
                    ) : (
                      <p className="text-xs text-slate-500 dark:text-slate-300">
                        Карточка команды недоступна.
                      </p>
                    )

                    const eventType = String(event.type || '').toLowerCase()
                    if (
                      eventType !== TEAM_REGISTERED_TO_GAME_EVENT &&
                      eventType !== TEAM_UNREGISTERED_FROM_GAME_EVENT
                    ) {
                      // Для событий создания и удаления команды показывать пользователя
                      if (
                        eventType === TEAM_CREATED_EVENT ||
                        eventType === TEAM_DELETED_EVENT
                      ) {
                        const actorUserId = String(
                          event.actorUserId || '',
                        ).trim()
                        const actor = actorUserId
                          ? userDetailsById[actorUserId]
                          : null
                        const isActorResolved = actorUserId
                          ? hasOwn(userDetailsById, actorUserId)
                          : false
                        const actorCard = !isActorResolved ? (
                          <p className="text-xs text-slate-500 dark:text-slate-300">
                            Загрузка карточки пользователя...
                          </p>
                        ) : actor ? (
                          <TeamMemberCard
                            member={{
                              id: actor.id || actorUserId,
                              name: actor.name || 'Без имени',
                              username: actor.username || '',
                              userRole: actor.role || 'client',
                              hasLinkedUser: true,
                              phone: actor.phone || '',
                              isCaptain: false,
                            }}
                            onOpen={handleOpenUserCard}
                          />
                        ) : (
                          <p className="text-xs text-slate-500 dark:text-slate-300">
                            Карточка пользователя недоступна.
                          </p>
                        )
                        return (
                          <>
                            {actorCard}
                            {teamCard}
                          </>
                        )
                      }
                      return teamCard
                    }

                    const gameId = String(event.gameId || '').trim()
                    const game = gameId ? gameDetailsById[gameId] : null
                    const gameName = game?.name || event.gameName || 'Игра'
                    const gameDate = game?.dateStart
                      ? formatDateTime(game.dateStart)
                      : 'Дата не указана'

                    return (
                      <>
                        {teamCard}
                        <div className="text-xs text-slate-500 dark:text-slate-300">
                          Игра: {gameName} · {gameDate}
                        </div>
                      </>
                    )
                  })()}
                </div>
              ) : null}
            </article>
          ))
        )}
      </section>

      {hasMore ? (
        <div className="flex justify-center">
          <CabinetButton
            variant="secondary"
            disabled={isLoadingMore || isLoading}
            onClick={handleLoadMore}
          >
            {isLoadingMore ? 'Загружаем...' : 'Загрузить ещё'}
          </CabinetButton>
        </div>
      ) : null}
      <Modal
        isOpen={isUserModalOpen}
        onClose={closeUserModal}
        title={`Пользователь — ${selectedUserForModal?.name || 'Без имени'}`}
      >
        {isUserModalLoading ? (
          <p className="text-sm text-slate-500 dark:text-slate-300">
            Загружаем данные пользователя...
          </p>
        ) : selectedUserForModal ? (
          <div className="space-y-5">
            <FormSectionCard className="space-y-4">
              <div className="flex items-start gap-3">
                <img
                  src={getUserAvatarSrc(selectedUserForModal)}
                  alt={selectedUserForModal.name || 'Аватар пользователя'}
                  className="h-20 w-20 shrink-0 rounded-full border border-slate-200 object-cover dark:border-slate-700"
                  loading="lazy"
                />
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    {selectedUserForModal.name || 'Без имени'}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-300">
                    @{selectedUserForModal.username || 'без ника'}
                  </p>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/60">
                  <p className="text-xs text-slate-500 dark:text-slate-300">
                    Роль
                  </p>
                  <p className="mt-1 text-sm text-slate-900 dark:text-slate-100">
                    {selectedUserForModal.role || 'client'}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/60">
                  <p className="text-xs text-slate-500 dark:text-slate-300">
                    Команд
                  </p>
                  <p className="mt-1 text-sm text-slate-900 dark:text-slate-100">
                    {Number(selectedUserForModal.teamsCount || 0)}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/60">
                  <p className="text-xs text-slate-500 dark:text-slate-300">
                    Игр
                  </p>
                  <p className="mt-1 text-sm text-slate-900 dark:text-slate-100">
                    {Number(selectedUserForModal.gamesCount || 0)}
                  </p>
                </div>
              </div>
            </FormSectionCard>

            <FormSectionCard className="space-y-3">
              <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Команды пользователя
              </h4>
              {Array.isArray(selectedUserForModal.teams) &&
              selectedUserForModal.teams.length > 0 ? (
                <ul className="space-y-2">
                  {selectedUserForModal.teams.map((team) => (
                    <li key={team.id}>
                      <UserTeamCard team={team} onOpen={handleOpenTeamCard} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500 dark:text-slate-300">
                  Пользователь не состоит в командах.
                </p>
              )}
            </FormSectionCard>
          </div>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-300">
            Данные пользователя недоступны.
          </p>
        )}
      </Modal>
      <TeamDescriptionModal
        isOpen={isTeamModalOpen}
        onClose={closeTeamModal}
        selectedTeam={selectedTeamForModal}
        canLeaveTeam={false}
        isLeavingTeam={false}
        onLeaveTeam={undefined}
      />
    </CabinetLayout>
  )
}

AdminEventsPageClient.propTypes = {
  initialEvents: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string,
      type: PropTypes.string,
      location: PropTypes.string,
      message: PropTypes.string,
      actorUserId: PropTypes.string,
      actorTelegramId: PropTypes.number,
      targetUserId: PropTypes.string,
      teamId: PropTypes.string,
      teamName: PropTypes.string,
      gameId: PropTypes.string,
      gameName: PropTypes.string,
      createdAt: PropTypes.string,
    }),
  ),
  initialHasMore: PropTypes.bool,
  session: PropTypes.shape({
    user: PropTypes.shape({
      role: PropTypes.string,
    }),
  }),
}

AdminEventsPageClient.defaultProps = {
  initialEvents: [],
  initialHasMore: false,
  session: null,
}

export default AdminEventsPageClient
