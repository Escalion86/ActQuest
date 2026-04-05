'use client'

import { useCallback, useMemo, useState } from 'react'
import PropTypes from 'prop-types'

import CabinetLayout from '@components/cabinet/CabinetLayout'
import CabinetButton from '@components/cabinet/CabinetButton'
import FormSectionCard from '@components/cabinet/FormSectionCard'
import NoticeBanner from '@components/NoticeBanner'
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
    async (locationValue) => {
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
      await loadEvents(nextLocationFilters)
    },
    [loadEvents, locationFilters],
  )

  const handleResetLocationFilters = useCallback(async () => {
    setLocationFilters([])
    await loadEvents([])
  }, [loadEvents])

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
                    onClick={() => void handleToggleLocationFilter(option.value)}
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
                {event.actorUserId ? (
                  <span>Инициатор ID: {event.actorUserId}</span>
                ) : null}
              </div>
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
