'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import Link from 'next/link'

import CabinetLayout from '@components/cabinet/CabinetLayout'
import CabinetButton from '@components/cabinet/CabinetButton'
import FormSectionCard from '@components/cabinet/FormSectionCard'
import NoticeBanner from '@components/NoticeBanner'
import Modal from '@components/Modal'
import {
  formatGameOrderPhone,
  getGameOrderPhoneHref,
  getGameOrderTelegramHref,
} from '@helpers/gameOrderContacts'
import requestApiJson from '@helpers/requestApiJson'
import isUserAdmin from '@helpers/isUserAdmin'
import useMergedSession from '@helpers/useMergedSession'
import { LOCATIONS } from '@server/serverConstants'

const PAGE_SIZE = 20
const API_BASE = '/api/cabinet/admin/game-orders'

const ORDER_STATUSES = [
  { value: 'all', label: 'Все статусы' },
  { value: 'new', label: 'Новая' },
  { value: 'contacted', label: 'Связались' },
  { value: 'confirmed', label: 'Подтверждена' },
  { value: 'converted', label: 'Создана игра' },
  { value: 'canceled', label: 'Отменена' },
]

const GAME_TYPE_LABELS = {
  classic: 'Classic',
  photo: 'Photo',
  story: 'Story',
  any: 'Помочь выбрать',
}

const STATUS_BADGE_CLASSES = {
  new: 'border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-500/35 dark:bg-cyan-500/10 dark:text-cyan-200',
  contacted:
    'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/35 dark:bg-amber-500/10 dark:text-amber-200',
  confirmed:
    'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/35 dark:bg-emerald-500/10 dark:text-emerald-200',
  converted:
    'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/35 dark:bg-violet-500/10 dark:text-violet-200',
  canceled:
    'border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200',
}

const normalizeOrder = (order) => ({
  id: typeof order?.id === 'string' ? order.id : '',
  companyName: typeof order?.companyName === 'string' ? order.companyName : '',
  contactName: typeof order?.contactName === 'string' ? order.contactName : '',
  phone: typeof order?.phone === 'string' ? order.phone : '',
  email: typeof order?.email === 'string' ? order.email : '',
  telegram: typeof order?.telegram === 'string' ? order.telegram : '',
  location: typeof order?.location === 'string' ? order.location : '',
  preferredDate:
    typeof order?.preferredDate === 'string' ? order.preferredDate : null,
  preferredTime:
    typeof order?.preferredTime === 'string' ? order.preferredTime : '',
  participantsCount: Number.isFinite(order?.participantsCount)
    ? Number(order.participantsCount)
    : null,
  gameType: typeof order?.gameType === 'string' ? order.gameType : 'any',
  comment: typeof order?.comment === 'string' ? order.comment : '',
  status: typeof order?.status === 'string' ? order.status : 'new',
  convertedGameId:
    typeof order?.convertedGameId === 'string' ? order.convertedGameId : null,
  managerComment:
    typeof order?.managerComment === 'string' ? order.managerComment : '',
  createdAt: typeof order?.createdAt === 'string' ? order.createdAt : null,
})

const formatDate = (value) => {
  const date = value ? new Date(value) : null
  if (!date || Number.isNaN(date.getTime())) {
    return 'Дата не указана'
  }
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
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
  }).format(date)
}

const getStatusLabel = (status) =>
  ORDER_STATUSES.find((item) => item.value === status)?.label || status

const getLocationLabel = (locationKey) => {
  const location = LOCATIONS?.[locationKey]
  if (!location?.townRu) {
    return locationKey || 'Не указан'
  }
  return location.townRu.charAt(0).toUpperCase() + location.townRu.slice(1)
}

const AdminGameOrdersPageClient = ({
  session: initialSession,
  initialOrders,
  initialHasMore,
}) => {
  const { activeSession } = useMergedSession(initialSession)
  const effectiveRole = activeSession?.user?.role ?? 'client'
  const isAdmin = isUserAdmin({ role: effectiveRole })
  const [orders, setOrders] = useState(
    Array.isArray(initialOrders)
      ? initialOrders.map((order) => normalizeOrder(order))
      : [],
  )
  const [hasMore, setHasMore] = useState(Boolean(initialHasMore))
  const [statusFilter, setStatusFilter] = useState('all')
  const [locationFilter, setLocationFilter] = useState('all')
  const [feedback, setFeedback] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [managerComment, setManagerComment] = useState('')
  const [convertName, setConvertName] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isConverting, setIsConverting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const locationOptions = useMemo(
    () => [
      { value: 'all', label: 'Все города' },
      ...Object.entries(LOCATIONS)
        .filter(([, value]) => !value?.hidden)
        .map(([key, value]) => ({
          value: key,
          label:
            typeof value?.townRu === 'string' && value.townRu
              ? value.townRu.charAt(0).toUpperCase() + value.townRu.slice(1)
              : key,
        })),
    ],
    [],
  )

  const buildQuery = useCallback((offset, limit) => {
    const params = new URLSearchParams({
      offset: String(offset),
      limit: String(limit),
    })
    if (statusFilter !== 'all') {
      params.set('status', statusFilter)
    }
    if (locationFilter !== 'all') {
      params.set('location', locationFilter)
    }
    return params.toString()
  }, [locationFilter, statusFilter])

  const loadOrders = useCallback(async () => {
    setIsLoading(true)
    setFeedback(null)
    try {
      const { json } = await requestApiJson(`${API_BASE}?${buildQuery(0, PAGE_SIZE)}`, {
        fallbackMessage: 'Не удалось загрузить заявки',
      })
      setOrders(
        Array.isArray(json?.data)
          ? json.data.map((order) => normalizeOrder(order))
          : [],
      )
      setHasMore(Boolean(json?.meta?.hasMore))
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error?.message || 'Не удалось загрузить заявки',
      })
    } finally {
      setIsLoading(false)
    }
  }, [buildQuery])

  useEffect(() => {
    void loadOrders()
  }, [loadOrders])

  const handleLoadMore = useCallback(async () => {
    setIsLoadingMore(true)
    setFeedback(null)
    try {
      const { json } = await requestApiJson(
        `${API_BASE}?${buildQuery(orders.length, PAGE_SIZE)}`,
        { fallbackMessage: 'Не удалось загрузить заявки' },
      )
      const nextOrders = Array.isArray(json?.data)
        ? json.data.map((order) => normalizeOrder(order))
        : []
      setOrders((prev) => [...prev, ...nextOrders])
      setHasMore(Boolean(json?.meta?.hasMore))
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error?.message || 'Не удалось загрузить заявки',
      })
    } finally {
      setIsLoadingMore(false)
    }
  }, [buildQuery, orders.length])

  const handleOpenOrder = useCallback((order) => {
    setSelectedOrder(order)
    setManagerComment(order.managerComment || '')
    setConvertName(
      order.companyName
        ? `Корпоративная игра: ${order.companyName}`
        : `Заказная игра: ${order.contactName || 'клиент'}`,
    )
  }, [])

  const patchOrder = useCallback(
    async (orderId, data) => {
      const { json } = await requestApiJson(`${API_BASE}/${orderId}`, {
        method: 'PATCH',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
        fallbackMessage: 'Не удалось обновить заявку',
      })
      const updated = normalizeOrder(json?.data)
      setOrders((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item)),
      )
      setSelectedOrder((prev) => (prev?.id === updated.id ? updated : prev))
      return updated
    },
    [],
  )

  const handleStatusChange = useCallback(
    async (event) => {
      if (!selectedOrder?.id) {
        return
      }
      setIsSaving(true)
      setFeedback(null)
      try {
        await patchOrder(selectedOrder.id, { status: event.target.value })
      } catch (error) {
        setFeedback({
          type: 'error',
          message: error?.message || 'Не удалось обновить статус',
        })
      } finally {
        setIsSaving(false)
      }
    },
    [patchOrder, selectedOrder?.id],
  )

  const handleSaveComment = useCallback(async () => {
    if (!selectedOrder?.id) {
      return
    }
    setIsSaving(true)
    setFeedback(null)
    try {
      await patchOrder(selectedOrder.id, { managerComment })
      setFeedback({ type: 'success', message: 'Комментарий сохранен' })
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error?.message || 'Не удалось сохранить комментарий',
      })
    } finally {
      setIsSaving(false)
    }
  }, [managerComment, patchOrder, selectedOrder?.id])

  const handleConvert = useCallback(async () => {
    if (!selectedOrder?.id) {
      return
    }
    setIsConverting(true)
    setFeedback(null)
    try {
      const { json } = await requestApiJson(
        `${API_BASE}/${selectedOrder.id}/convert-to-game`,
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: convertName }),
          fallbackMessage: 'Не удалось создать игру',
        },
      )
      const updated = normalizeOrder(json?.data?.order)
      setOrders((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item)),
      )
      setSelectedOrder(updated)
      setFeedback({
        type: 'success',
        message: `Игра создана: ${json?.data?.game?.name || convertName}`,
      })
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error?.message || 'Не удалось создать игру',
      })
    } finally {
      setIsConverting(false)
    }
  }, [convertName, selectedOrder?.id])

  const handleDeleteOrder = useCallback(async () => {
    if (!selectedOrder?.id || isDeleting) {
      return
    }
    const shouldDelete = window.confirm(
      'Удалить заявку безвозвратно? Это действие нельзя отменить.',
    )
    if (!shouldDelete) {
      return
    }
    setIsDeleting(true)
    setFeedback(null)
    try {
      await requestApiJson(`${API_BASE}/${selectedOrder.id}`, {
        method: 'DELETE',
        headers: {
          Accept: 'application/json',
        },
        fallbackMessage: 'Не удалось удалить заявку',
      })
      setOrders((prev) => prev.filter((item) => item.id !== selectedOrder.id))
      setSelectedOrder(null)
      setFeedback({ type: 'success', message: 'Заявка удалена' })
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error?.message || 'Не удалось удалить заявку',
      })
    } finally {
      setIsDeleting(false)
    }
  }, [isDeleting, selectedOrder?.id])

  const renderPhoneLink = useCallback((phone, fallback = null) => {
    const formattedPhone = formatGameOrderPhone(phone)
    const phoneHref = getGameOrderPhoneHref(phone)
    if (!formattedPhone || !phoneHref) {
      return fallback
    }
    return (
      <a
        href={phoneHref}
        className="font-semibold text-cyan-700 underline-offset-2 hover:underline dark:text-cyan-200"
      >
        {formattedPhone}
      </a>
    )
  }, [])

  const renderTelegramLink = useCallback((telegram, fallback = null) => {
    const telegramHref = getGameOrderTelegramHref(telegram)
    if (!telegram || !telegramHref) {
      return fallback
    }
    return (
      <a
        href={telegramHref}
        target="_blank"
        rel="noreferrer"
        className="font-semibold text-cyan-700 underline-offset-2 hover:underline dark:text-cyan-200"
      >
        {telegram}
      </a>
    )
  }, [])

  if (!isAdmin) {
    return (
      <CabinetLayout
        title="Заявки на игры"
        description="Доступ ограничен."
        activePage="admin"
      >
        <NoticeBanner tone="warning">
          У вас нет прав для просмотра заявок.
        </NoticeBanner>
      </CabinetLayout>
    )
  }

  return (
    <CabinetLayout
      title="Заявки на игры"
      description="Обрабатывайте заявки на корпоративные и частные игры."
      activePage="admin"
    >
      <FormSectionCard className="grid gap-3 md:grid-cols-3">
        <label className="grid gap-1 text-sm font-semibold text-slate-700 dark:text-slate-200">
          Статус
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
          >
            {ORDER_STATUSES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-semibold text-slate-700 dark:text-slate-200">
          Город
          <select
            value={locationFilter}
            onChange={(event) => setLocationFilter(event.target.value)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
          >
            {locationOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end">
          <CabinetButton
            variant="secondary"
            disabled={isLoading}
            onClick={() => void loadOrders()}
            className="w-full"
          >
            {isLoading ? 'Загружаем...' : 'Обновить'}
          </CabinetButton>
        </div>
      </FormSectionCard>

      {feedback?.message ? (
        <NoticeBanner tone={feedback.type === 'error' ? 'error' : 'success'}>
          {feedback.message}
        </NoticeBanner>
      ) : null}

      <section className="space-y-3">
        {orders.length === 0 ? (
          <NoticeBanner tone="info">Заявки не найдены.</NoticeBanner>
        ) : (
          orders.map((order) => (
            <article
              key={order.id}
              className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-semibold text-primary dark:text-slate-100">
                      {order.companyName || order.contactName || 'Заявка'}
                    </h2>
                    <span
                      className={`rounded-full border px-2 py-1 text-xs font-semibold ${
                        STATUS_BADGE_CLASSES[order.status] ||
                        STATUS_BADGE_CLASSES.new
                      }`}
                    >
                      {getStatusLabel(order.status)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    {getLocationLabel(order.location)} ·{' '}
                    {GAME_TYPE_LABELS[order.gameType] || order.gameType} ·{' '}
                    {order.participantsCount
                      ? `${order.participantsCount} участников`
                      : 'участники не указаны'}
                  </p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    Дата: {formatDate(order.preferredDate)}
                    {order.preferredTime ? `, ${order.preferredTime}` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {order.convertedGameId ? (
                    <Link
                      href={`/game/${order.convertedGameId}`}
                      className="rounded-xl border border-cyan-400/50 px-3 py-2 text-xs font-semibold text-cyan-700 transition hover:bg-cyan-50 dark:text-cyan-200 dark:hover:bg-cyan-500/10"
                    >
                      Открыть игру
                    </Link>
                  ) : null}
                  <CabinetButton
                    size="sm"
                    variant="secondary"
                    onClick={() => handleOpenOrder(order)}
                  >
                    Открыть
                  </CabinetButton>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-300">
                <span>Контакт: {order.contactName || 'не указан'}</span>
                {order.phone ? <span>{renderPhoneLink(order.phone)}</span> : null}
                {order.telegram ? (
                  <span>{renderTelegramLink(order.telegram)}</span>
                ) : null}
                {order.email ? <span>{order.email}</span> : null}
                <span>Создана: {formatDateTime(order.createdAt)}</span>
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
            onClick={() => void handleLoadMore()}
          >
            {isLoadingMore ? 'Загружаем...' : 'Загрузить ещё'}
          </CabinetButton>
        </div>
      ) : null}

      <Modal
        isOpen={Boolean(selectedOrder)}
        onClose={() => setSelectedOrder(null)}
        title="Заявка на игру"
        footer={
          <>
            <button
              type="button"
              onClick={() => setSelectedOrder(null)}
              disabled={isDeleting}
              className="aq-modal-btn aq-modal-btn-secondary"
            >
              Закрыть
            </button>
            <button
              type="button"
              onClick={() => void handleDeleteOrder()}
              disabled={isDeleting || isSaving || isConverting}
              className="aq-modal-btn aq-modal-btn-secondary border-red-300 text-red-700 hover:bg-red-50 dark:border-red-500/50 dark:text-red-200 dark:hover:bg-red-500/10"
            >
              {isDeleting ? 'Удаляем...' : 'Удалить'}
            </button>
            <button
              type="button"
              onClick={() => void handleSaveComment()}
              disabled={isSaving || isDeleting}
              className="aq-modal-btn aq-modal-btn-primary"
            >
              {isSaving ? 'Сохраняем...' : 'Сохранить'}
            </button>
          </>
        }
        compactMobile
      >
        {selectedOrder ? (
          <div className="space-y-5">
            <FormSectionCard className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-300">
                    Компания
                  </p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {selectedOrder.companyName || 'Не указана'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-300">
                    Контакт
                  </p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {selectedOrder.contactName || 'Не указан'}
                  </p>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  {renderPhoneLink(selectedOrder.phone, 'Телефон не указан')}
                </div>
                <div>
                  {renderTelegramLink(
                    selectedOrder.telegram,
                    'Telegram не указан',
                  )}
                </div>
                <div>{selectedOrder.email || 'Email не указан'}</div>
              </div>
              {selectedOrder.comment ? (
                <p className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">
                  {selectedOrder.comment}
                </p>
              ) : null}
            </FormSectionCard>

            <FormSectionCard className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-1 text-sm font-semibold text-slate-700 dark:text-slate-200">
                Статус
                <select
                  value={selectedOrder.status}
                  onChange={handleStatusChange}
                  disabled={isSaving}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
                >
                  {ORDER_STATUSES.filter((item) => item.value !== 'all').map(
                    (item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ),
                  )}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-semibold text-slate-700 dark:text-slate-200">
                Название игры
                <input
                  value={convertName}
                  onChange={(event) => setConvertName(event.target.value)}
                  disabled={Boolean(selectedOrder.convertedGameId)}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
                />
              </label>
              <label className="grid gap-1 text-sm font-semibold text-slate-700 dark:text-slate-200 md:col-span-2">
                Комментарий менеджера
                <textarea
                  value={managerComment}
                  onChange={(event) => setManagerComment(event.target.value)}
                  rows={4}
                  className="resize-none rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
                />
              </label>
              <div className="md:col-span-2">
                {selectedOrder.convertedGameId ? (
                  <NoticeBanner tone="success">
                    Игра уже создана. ID: {selectedOrder.convertedGameId}
                  </NoticeBanner>
                ) : (
                  <CabinetButton
                    tone="success"
                    disabled={isConverting || isDeleting}
                    onClick={() => void handleConvert()}
                  >
                    {isConverting ? 'Создаем игру...' : 'Создать скрытую игру'}
                  </CabinetButton>
                )}
              </div>
            </FormSectionCard>
          </div>
        ) : null}
      </Modal>
    </CabinetLayout>
  )
}

const orderShape = PropTypes.shape({
  id: PropTypes.string,
  companyName: PropTypes.string,
  contactName: PropTypes.string,
  phone: PropTypes.string,
  email: PropTypes.string,
  telegram: PropTypes.string,
  location: PropTypes.string,
  preferredDate: PropTypes.string,
  preferredTime: PropTypes.string,
  participantsCount: PropTypes.number,
  gameType: PropTypes.string,
  comment: PropTypes.string,
  status: PropTypes.string,
  convertedGameId: PropTypes.string,
  managerComment: PropTypes.string,
  createdAt: PropTypes.string,
})

AdminGameOrdersPageClient.propTypes = {
  session: PropTypes.shape({
    user: PropTypes.shape({
      role: PropTypes.string,
    }),
  }),
  initialOrders: PropTypes.arrayOf(orderShape),
  initialHasMore: PropTypes.bool,
}

AdminGameOrdersPageClient.defaultProps = {
  session: null,
  initialOrders: [],
  initialHasMore: false,
}

export default AdminGameOrdersPageClient
