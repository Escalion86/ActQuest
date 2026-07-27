'use client'

import Link from 'next/link'
import PropTypes from 'prop-types'
import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'

import NoticeBanner from '@components/NoticeBanner'
import requestApiJson from '@helpers/requestApiJson'

const RATING_VALUES = Array.from({ length: 10 }, (_, index) => index + 1)
const TAG_OPTIONS = [
  { value: 'interesting_tasks', label: 'Интересные задания' },
  { value: 'atmosphere', label: 'Атмосфера' },
  { value: 'organization', label: 'Организация' },
  { value: 'good_difficulty', label: 'Хорошая сложность' },
  { value: 'too_difficult', label: 'Было слишком сложно' },
  { value: 'technical_issues', label: 'Технические проблемы' },
]

const EMPTY_FORM = {
  overallRating: 0,
  tags: [],
  likedText: '',
  improvementText: '',
  publicationConsent: false,
}

const loadGameReview = async (gameId) => {
  const { json } = await requestApiJson(
    `/api/cabinet/games/${encodeURIComponent(gameId)}/review`,
    { fallbackMessage: 'Не удалось загрузить отзыв' },
  )
  return json?.data || null
}

const GameReviewCard = ({ gameId, location }) => {
  const { data: session, status: sessionStatus } = useSession()
  const queryClient = useQueryClient()
  const [form, setForm] = useState(EMPTY_FORM)
  const [feedback, setFeedback] = useState(null)
  const queryKey = ['game-review', gameId]
  const isAuthenticated = sessionStatus === 'authenticated' && Boolean(session?.user)

  const reviewQuery = useQuery({
    queryKey,
    queryFn: () => loadGameReview(gameId),
    enabled: Boolean(gameId && isAuthenticated),
    staleTime: 30_000,
  })

  const review = reviewQuery.data?.review || null
  const isEligible = reviewQuery.data?.eligible === true

  useEffect(() => {
    if (!review) return
    setForm({
      overallRating: Number(review.overallRating) || 0,
      tags: Array.isArray(review.tags) ? review.tags : [],
      likedText: typeof review.likedText === 'string' ? review.likedText : '',
      improvementText:
        typeof review.improvementText === 'string'
          ? review.improvementText
          : '',
      publicationConsent: review.publicationConsent === true,
    })
  }, [review])

  const saveReviewMutation = useMutation({
    mutationFn: async (payload) => {
      const { json } = await requestApiJson(
        `/api/cabinet/games/${encodeURIComponent(gameId)}/review`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          fallbackMessage: 'Не удалось сохранить отзыв',
        },
      )
      return json?.data?.review || null
    },
    onSuccess: (savedReview) => {
      queryClient.setQueryData(queryKey, (current) => ({
        ...(current || {}),
        eligible: true,
        review: savedReview,
      }))
      setFeedback({
        type: 'success',
        message: review
          ? 'Изменения в отзыве сохранены'
          : 'Спасибо! Ваш отзыв сохранён',
      })
    },
    onError: (error) => {
      setFeedback({
        type: 'error',
        message: error?.message || 'Не удалось сохранить отзыв',
      })
    },
  })

  if (sessionStatus === 'loading') return null

  if (!isAuthenticated) {
    const callbackUrl = `/${location}/game/result/${gameId}#game-review`
    return (
      <section
        id="game-review"
        className="mx-auto my-8 max-w-3xl rounded-3xl border border-cyan-200 bg-white p-6 shadow-xl dark:border-cyan-500/30 dark:bg-slate-900"
      >
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          Как вам игра?
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Войдите в кабинет, чтобы оставить отзыв участника.
        </p>
        <Link
          href={`/cabinet/login?callbackUrl=${encodeURIComponent(callbackUrl)}`}
          className="mt-4 inline-flex rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-700"
        >
          Войти и оценить
        </Link>
      </section>
    )
  }

  if (reviewQuery.isLoading) {
    return (
      <section
        id="game-review"
        className="mx-auto my-8 max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
      >
        Загружаем форму отзыва…
      </section>
    )
  }

  if (reviewQuery.isError) {
    return (
      <section id="game-review" className="mx-auto my-8 max-w-3xl px-4">
        <NoticeBanner tone="error">
          {reviewQuery.error?.message || 'Не удалось загрузить форму отзыва'}
        </NoticeBanner>
      </section>
    )
  }

  if (!isEligible && !review) return null

  const handleToggleTag = (tag) => {
    setForm((current) => ({
      ...current,
      tags: current.tags.includes(tag)
        ? current.tags.filter((item) => item !== tag)
        : [...current.tags, tag],
    }))
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    setFeedback(null)
    if (!Number.isInteger(form.overallRating) || form.overallRating < 1) {
      setFeedback({ type: 'error', message: 'Выберите оценку от 1 до 10' })
      return
    }
    saveReviewMutation.mutate(form)
  }

  return (
    <section
      id="game-review"
      className="mx-auto my-8 max-w-3xl rounded-3xl border border-cyan-200 bg-white p-6 shadow-xl dark:border-cyan-500/30 dark:bg-slate-900 sm:p-8"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-600 dark:text-cyan-300">
            Отзыв участника
          </p>
          <h2 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
            Как вам игра?
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Оцените впечатления по шкале от 1 до 10. Комментарии необязательны.
          </p>
        </div>
        {review ? (
          <span className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200">
            Отзыв сохранён
          </span>
        ) : null}
      </div>

      <form className="mt-6 space-y-6" onSubmit={handleSubmit}>
        <fieldset>
          <legend className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            Ваша оценка
          </legend>
          <div className="mt-3 grid grid-cols-5 gap-2 sm:grid-cols-10" role="radiogroup">
            {RATING_VALUES.map((rating) => {
              const isSelected = form.overallRating === rating
              return (
                <button
                  key={rating}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      overallRating: rating,
                    }))
                  }
                  className={`h-11 rounded-xl border text-sm font-bold transition ${
                    isSelected
                      ? 'border-cyan-600 bg-cyan-600 text-white shadow-md'
                      : 'border-slate-300 bg-white text-slate-700 hover:border-cyan-400 hover:bg-cyan-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-cyan-500/10'
                  }`}
                >
                  {rating}
                </button>
              )
            })}
          </div>
          <div className="mt-2 flex justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Совсем не понравилось</span>
            <span>Отличная игра</span>
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            Что особенно запомнилось?
          </legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {TAG_OPTIONS.map((tag) => {
              const isSelected = form.tags.includes(tag.value)
              return (
                <button
                  key={tag.value}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => handleToggleTag(tag.value)}
                  className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${
                    isSelected
                      ? 'border-cyan-500 bg-cyan-100 text-cyan-800 dark:bg-cyan-500/20 dark:text-cyan-100'
                      : 'border-slate-300 text-slate-600 hover:border-cyan-400 dark:border-slate-600 dark:text-slate-300'
                  }`}
                >
                  {tag.label}
                </button>
              )
            })}
          </div>
        </fieldset>

        <label className="block">
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            Что понравилось?
          </span>
          <textarea
            value={form.likedText}
            maxLength={1500}
            rows={4}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                likedText: event.target.value,
              }))
            }
            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:focus:ring-cyan-500/20"
            placeholder="Расскажите о лучших моментах игры"
          />
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            Что можно улучшить?
          </span>
          <textarea
            value={form.improvementText}
            maxLength={1500}
            rows={4}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                improvementText: event.target.value,
              }))
            }
            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:focus:ring-cyan-500/20"
            placeholder="Напишите, если что-то мешало или было непонятно"
          />
        </label>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300">
          <input
            type="checkbox"
            checked={form.publicationConsent}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                publicationConsent: event.target.checked,
              }))
            }
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
          />
          <span>
            Разрешаю опубликовать мой отзыв после проверки. Без согласия он будет виден только организаторам.
          </span>
        </label>

        {feedback ? (
          <NoticeBanner tone={feedback.type}>{feedback.message}</NoticeBanner>
        ) : null}

        <button
          type="submit"
          disabled={saveReviewMutation.isPending}
          className="inline-flex w-full justify-center rounded-xl bg-cyan-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          {saveReviewMutation.isPending
            ? 'Сохраняем…'
            : review
              ? 'Сохранить изменения'
              : 'Отправить отзыв'}
        </button>
      </form>
    </section>
  )
}

GameReviewCard.propTypes = {
  gameId: PropTypes.string.isRequired,
  location: PropTypes.string.isRequired,
}

export default GameReviewCard
