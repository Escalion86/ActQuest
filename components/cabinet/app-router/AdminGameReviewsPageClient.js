'use client'

import PropTypes from 'prop-types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import CabinetButton from '@components/cabinet/CabinetButton'
import CabinetLayout from '@components/cabinet/CabinetLayout'
import FormSectionCard from '@components/cabinet/FormSectionCard'
import NoticeBanner from '@components/NoticeBanner'
import isUserAdmin from '@helpers/isUserAdmin'
import requestApiJson from '@helpers/requestApiJson'
import useMergedSession from '@helpers/useMergedSession'
import { LOCATIONS } from '@server/serverConstants'

const PAGE_SIZE = 50
const TAG_LABELS = {
  interesting_tasks: 'Интересные задания',
  atmosphere: 'Атмосфера',
  organization: 'Организация',
  story: 'Сюжет',
  route_and_locations: 'Маршрут и локации',
  teamwork: 'Командная игра',
  unexpected_moments: 'Неожиданные моменты',
  actors: 'Актёры',
  // Подписи оставлены для ранее сохранённых отзывов.
  good_difficulty: 'Хорошая сложность',
  too_difficult: 'Слишком сложно',
  technical_issues: 'Технические проблемы',
}
const STATUS_LABELS = {
  pending: 'Ожидает проверки',
  approved: 'Одобрен',
  rejected: 'Отклонён',
}
const STATUS_BADGE_CLASSES = {
  pending:
    'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200',
  approved:
    'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200',
  rejected:
    'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200',
}

const formatDate = (value) => {
  const date = value ? new Date(value) : null
  if (!date || Number.isNaN(date.getTime())) return 'Дата неизвестна'
  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

const formatRating = (value) => {
  if (value === null || value === undefined || value === '') return '—'
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric.toFixed(1) : '—'
}

const formatGameDate = (value) => {
  const date = value ? new Date(value) : null
  if (!date || Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium' }).format(date)
}

const loadReviews = async ({
  location,
  moderationStatus,
  rating,
  difficultyRating,
  gameId,
  ratingIncluded,
}) => {
  const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: '0' })
  if (location !== 'all') params.set('location', location)
  if (moderationStatus !== 'all') {
    params.set('moderationStatus', moderationStatus)
  }
  if (rating !== 'all') params.set('rating', rating)
  if (difficultyRating !== 'all') {
    params.set('difficultyRating', difficultyRating)
  }
  if (gameId !== 'all') params.set('gameId', gameId)
  if (ratingIncluded !== 'all') {
    params.set('ratingIncluded', ratingIncluded)
  }

  const { json } = await requestApiJson(
    `/api/cabinet/admin/game-reviews?${params.toString()}`,
    { fallbackMessage: 'Не удалось загрузить отзывы' },
  )
  return { items: Array.isArray(json?.data) ? json.data : [], meta: json?.meta || {} }
}

const AdminGameReviewsPageClient = ({ session: initialSession }) => {
  const { activeSession } = useMergedSession(initialSession)
  const queryClient = useQueryClient()
  const [location, setLocation] = useState('all')
  const [moderationStatus, setModerationStatus] = useState('all')
  const [rating, setRating] = useState('all')
  const [difficultyRating, setDifficultyRating] = useState('all')
  const [gameId, setGameId] = useState('all')
  const [ratingIncluded, setRatingIncluded] = useState('all')
  const isAdmin = isUserAdmin({ role: activeSession?.user?.role })
  const queryKey = [
    'admin-game-reviews',
    {
      location,
      moderationStatus,
      rating,
      difficultyRating,
      gameId,
      ratingIncluded,
    },
  ]

  const reviewsQuery = useQuery({
    queryKey,
    queryFn: () =>
      loadReviews({
        location,
        moderationStatus,
        rating,
        difficultyRating,
        gameId,
        ratingIncluded,
      }),
    enabled: isAdmin,
    placeholderData: (previousData) => previousData,
  })

  const reviewUpdateMutation = useMutation({
    mutationFn: async ({ reviewId, ...updates }) => {
      const { json } = await requestApiJson('/api/cabinet/admin/game-reviews', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewId, ...updates }),
        fallbackMessage: 'Не удалось обновить отзыв',
      })
      return json?.data?.review || null
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-game-reviews'] }),
  })

  const handleExcludeFromRating = (review) => {
    const reason = window.prompt(
      'Укажите причину, по которой оценка не должна учитываться в рейтинге:',
      review.ratingExclusionReason || '',
    )
    if (reason === null) return
    if (!reason.trim()) {
      window.alert('Причина исключения обязательна')
      return
    }
    reviewUpdateMutation.mutate({
      reviewId: review.id,
      ratingIncluded: false,
      ratingExclusionReason: reason.trim(),
    })
  }

  const handleIncludeInRating = (review) => {
    if (!window.confirm('Снова учитывать эту оценку в рейтинге игры?')) return
    reviewUpdateMutation.mutate({
      reviewId: review.id,
      ratingIncluded: true,
    })
  }

  const handleRejectReview = (review) => {
    const reason = window.prompt(
      'Укажите причину отклонения. Игрок увидит её и сможет исправить отзыв:',
      review.moderationReason || '',
    )
    if (reason === null) return
    if (!reason.trim()) {
      window.alert('Причина отклонения обязательна')
      return
    }
    reviewUpdateMutation.mutate({
      reviewId: review.id,
      moderationStatus: 'rejected',
      moderationReason: reason.trim(),
    })
  }

  const locationOptions = Object.entries(LOCATIONS)
    .filter(([, config]) => !config?.hidden)
    .map(([key, config]) => ({
      value: key,
      label:
        typeof config?.townRu === 'string' && config.townRu
          ? config.townRu.charAt(0).toUpperCase() + config.townRu.slice(1)
          : key,
    }))

  if (!isAdmin) {
    return (
      <CabinetLayout title="Отзывы об играх" activePage="admin">
        <NoticeBanner tone="error">Недостаточно прав</NoticeBanner>
      </CabinetLayout>
    )
  }

  const data = reviewsQuery.data || { items: [], meta: {} }

  return (
    <CabinetLayout
      title="Отзывы об играх"
      description="Просматривайте оценки участников и модерируйте отзывы, разрешённые к публикации."
      activePage="admin"
    >
      <div className="space-y-6">
        <FormSectionCard>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-7">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-200 xl:col-span-2">
              Игра
              <select
                value={gameId}
                onChange={(event) => setGameId(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
              >
                <option value="all">Все игры</option>
                {(Array.isArray(data.meta.games) ? data.meta.games : []).map(
                  (game) => {
                    const dateLabel = formatGameDate(game.dateStart)
                    return (
                      <option key={game.id} value={game.id}>
                        {game.name}{dateLabel ? ` · ${dateLabel}` : ''}
                      </option>
                    )
                  },
                )}
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Город
              <select
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
              >
                <option value="all">Все города</option>
                {locationOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Проверка
              <select
                value={moderationStatus}
                onChange={(event) => setModerationStatus(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
              >
                <option value="all">Все статусы</option>
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Оценка
              <select
                value={rating}
                onChange={(event) => setRating(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
              >
                <option value="all">Все оценки</option>
                {Array.from({ length: 10 }, (_, index) => index + 1).map(
                  (value) => (
                    <option key={value} value={value}>
                      {value.toFixed(1)}
                    </option>
                  ),
                )}
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Сложность
              <select
                value={difficultyRating}
                onChange={(event) => setDifficultyRating(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
              >
                <option value="all">Любая сложность</option>
                {Array.from({ length: 10 }, (_, index) => index + 1).map(
                  (value) => (
                    <option key={value} value={value}>
                      {value.toFixed(1)}
                    </option>
                  ),
                )}
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Учёт рейтинга
              <select
                value={ratingIncluded}
                onChange={(event) => setRatingIncluded(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
              >
                <option value="all">Все отзывы</option>
                <option value="included">Учитываются</option>
                <option value="excluded">Не учитываются</option>
              </select>
            </label>
          </div>
          <div className="mt-5 flex flex-wrap gap-3 text-sm">
            <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              Отзывов: {Number(data.meta.total || 0)}
            </span>
            <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 font-semibold text-amber-800 dark:border-amber-400/45 dark:bg-amber-500/12 dark:text-amber-100">
              Средняя оценка: {formatRating(data.meta.averageRating)} ★
            </span>
            <span className="rounded-full bg-violet-100 px-3 py-1 font-semibold text-violet-800 dark:bg-violet-500/15 dark:text-violet-200">
              Средняя сложность:{' '}
              {formatRating(data.meta.averageDifficultyRating)} ◈
            </span>
            <span className="rounded-full bg-emerald-100 px-3 py-1 font-semibold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200">
              Согласием на публикацию: {Number(data.meta.publicationConsentCount || 0)}
            </span>
            <span className="rounded-full border border-rose-300 bg-rose-50 px-3 py-1 font-semibold text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
              Не учитываются: {Number(data.meta.ratingExcludedCount || 0)}
            </span>
          </div>
        </FormSectionCard>

        {reviewsQuery.isLoading ? (
          <FormSectionCard><p className="text-sm text-slate-500">Загружаем отзывы…</p></FormSectionCard>
        ) : null}
        {reviewsQuery.isError ? (
          <NoticeBanner tone="error">
            {reviewsQuery.error?.message || 'Не удалось загрузить отзывы'}
          </NoticeBanner>
        ) : null}
        {reviewUpdateMutation.isError ? (
          <NoticeBanner tone="error">
            {reviewUpdateMutation.error?.message || 'Не удалось обновить отзыв'}
          </NoticeBanner>
        ) : null}

        {!reviewsQuery.isLoading && data.items.length === 0 ? (
          <FormSectionCard><p className="text-sm text-slate-500">По выбранным фильтрам отзывов нет.</p></FormSectionCard>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-2">
          {data.items.map((review) => (
            <article
              key={review.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/80"
            >
              <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:gap-4">
                <div className="min-w-0">
                  <h2 className="truncate font-semibold text-slate-900 dark:text-white">
                    {review.gameName}
                  </h2>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {review.userName} · {review.teamName} · {formatDate(review.createdAt)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-semibold ${
                      STATUS_BADGE_CLASSES[review.moderationStatus] ||
                      'border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200'
                    }`}
                  >
                    {STATUS_LABELS[review.moderationStatus] ||
                      review.moderationStatus}
                  </span>
                  <span
                    className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-bold text-amber-800 dark:border-amber-400/45 dark:bg-amber-500/12 dark:text-amber-100"
                    title="Оценка игры"
                  >
                    {formatRating(review.overallRating)} ★
                  </span>
                  <span
                    className="inline-flex items-center rounded-full border border-violet-300 bg-violet-50 px-3 py-1.5 text-sm font-bold text-violet-800 dark:border-violet-400/45 dark:bg-violet-500/12 dark:text-violet-100"
                    title="Сложность игры"
                  >
                    {formatRating(review.difficultyRating)} ◈
                  </span>
                </div>
              </div>

              {review.isRatingIncluded === false ? (
                <div className="mt-4 rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
                  <p className="font-semibold">Не учитывается в рейтинге</p>
                  <p className="mt-1 text-xs">
                    Причина: {review.ratingExclusionReason || 'не указана'}
                  </p>
                </div>
              ) : null}

              {review.tags.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {review.tags.map((tag) => (
                    <span key={tag} className="rounded-full border border-slate-300 px-2.5 py-1 text-xs text-slate-600 dark:border-slate-600 dark:text-slate-300">
                      {TAG_LABELS[tag] || tag}
                    </span>
                  ))}
                </div>
              ) : null}
              {review.likedText ? (
                <div className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-100">
                  <p className="text-xs font-semibold uppercase tracking-wide">Понравилось</p>
                  <p className="mt-1 whitespace-pre-wrap">{review.likedText}</p>
                </div>
              ) : null}
              {review.improvementText ? (
                <div className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-100">
                  <p className="text-xs font-semibold uppercase tracking-wide">Можно улучшить</p>
                  <p className="mt-1 whitespace-pre-wrap">{review.improvementText}</p>
                </div>
              ) : null}

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {review.moderationStatus === 'rejected' &&
                  review.moderationReason ? (
                    <p className="max-w-md text-rose-700 dark:text-rose-200">
                      Причина отклонения: {review.moderationReason}
                    </p>
                  ) : null}
                  <p className="mt-1">
                    {review.publicationConsent
                      ? 'Игрок разрешил публикацию'
                      : 'Только для организаторов'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {review.moderationStatus !== 'approved' ? (
                    <CabinetButton
                      size="sm"
                      variant="soft"
                      tone="success"
                      disabled={reviewUpdateMutation.isPending}
                      onClick={() =>
                        reviewUpdateMutation.mutate({
                          reviewId: review.id,
                          moderationStatus: 'approved',
                        })
                      }
                    >
                      Одобрить
                    </CabinetButton>
                  ) : null}
                  {review.moderationStatus !== 'rejected' ? (
                    <CabinetButton
                      size="sm"
                      variant="soft"
                      tone="danger"
                      disabled={reviewUpdateMutation.isPending}
                      onClick={() => handleRejectReview(review)}
                    >
                      Отклонить
                    </CabinetButton>
                  ) : null}
                  <CabinetButton
                    size="sm"
                    variant="soft"
                    tone={review.isRatingIncluded === false ? 'success' : 'danger'}
                    disabled={reviewUpdateMutation.isPending}
                    onClick={() =>
                      review.isRatingIncluded === false
                        ? handleIncludeInRating(review)
                        : handleExcludeFromRating(review)
                    }
                  >
                    {review.isRatingIncluded === false
                      ? 'Учитывать в рейтинге'
                      : 'Не учитывать в рейтинге'}
                  </CabinetButton>
                </div>
              </div>
            </article>
          ))}
        </div>

        {data.meta.hasMore ? (
          <NoticeBanner tone="info">
            Показаны последние {PAGE_SIZE} отзывов. Используйте фильтры, чтобы сузить выборку.
          </NoticeBanner>
        ) : null}
      </div>
    </CabinetLayout>
  )
}

AdminGameReviewsPageClient.propTypes = {
  session: PropTypes.object.isRequired,
}

export default AdminGameReviewsPageClient
