'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'

import requestApiJson from '@helpers/requestApiJson'
import buildTaskDisplayContent from '@helpers/buildTaskDisplayContent'
import RichTaskContentView from '@components/game/RichTaskContentView'
import TaskDisplayWithClues from '@components/game/TaskDisplayWithClues'

const gameTypeLabel = (type) => (type === 'photo' ? 'Фотоквест' : 'Автоквест')
const resolveBackHrefByGameStatus = (statusValue) => {
  const status = String(statusValue || '')
    .trim()
    .toLowerCase()

  if (['finished', 'closed', 'canceled'].includes(status)) {
    return '/cabinet/games-past'
  }

  return '/cabinet/games-upcoming'
}
const buildBackHref = ({ status, gameId }) => {
  const baseHref = resolveBackHrefByGameStatus(status)
  const normalizedGameId =
    typeof gameId === 'string' ? gameId.trim() : String(gameId || '').trim()

  if (!normalizedGameId) {
    return baseHref
  }

  const params = new URLSearchParams()
  params.set('gameId', normalizedGameId)
  params.set('open', 'tasks')
  return `${baseHref}?${params.toString()}`
}
const normalizeString = (value) =>
  typeof value === 'string' ? value.trim() : ''

const toFiniteNonNegativeIntegerOrNull = (value) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return null
  const normalized = Math.floor(numeric)
  return normalized >= 0 ? normalized : null
}

const buildTaskDisplayMeta = (task) => ({
  mainCodesCount: Array.isArray(task?.codes) ? task.codes.length : 0,
  requiredCodesCount: toFiniteNonNegativeIntegerOrNull(
    task?.numCodesToCompliteTask,
  ),
  bonusCodesCount: Array.isArray(task?.bonusCodes) ? task.bonusCodes.length : 0,
  penaltyCodesCount: Array.isArray(task?.penaltyCodes)
    ? task.penaltyCodes.length
    : 0,
})

const buildPreviewQueryKey = ({ gameId, draftKey, taskIndex }) => [
  'game-task-preview',
  {
    gameId: gameId || '',
    draftKey: draftKey || '',
    taskIndex,
  },
]

const fetchTaskPreviewData = async ({ gameId, draftKey, taskIndex }) => {
  if (gameId) {
    const { json } = await requestApiJson(
      `/api/cabinet/admin/task-preview?gameId=${encodeURIComponent(gameId)}&taskIndex=${encodeURIComponent(String(taskIndex))}`,
      { fallbackMessage: 'Не удалось загрузить предпросмотр задания' },
    )

    if (!json?.success || !json?.data) {
      throw new Error(json?.error || 'Не удалось загрузить предпросмотр')
    }

    return json.data
  }

  if (draftKey) {
    const rawPayload = window.localStorage.getItem(draftKey)
    if (!rawPayload) {
      throw new Error('Не найден черновик предпросмотра')
    }
    const parsed = JSON.parse(rawPayload)
    const tasks = Array.isArray(parsed?.tasks) ? parsed.tasks : []
    if (tasks.length === 0) {
      throw new Error('В черновике нет заданий для предпросмотра')
    }

    const safeTaskIndex = Math.min(Math.max(taskIndex, 0), tasks.length - 1)
    const task = tasks[safeTaskIndex] || {}
    const clues = Array.isArray(task?.clues) ? task.clues : []
    const buildDraftCombinedVariant = (cluesCountToShow) =>
      buildTaskDisplayContent({
        task,
        visibleCluesCount: cluesCountToShow,
      })

    const baseVariant = buildDraftCombinedVariant(0)
    const variants = [
      {
        id: 'task',
        label: 'Текст задания',
        html: baseVariant.html,
        text: baseVariant.text,
      },
      ...clues.map((_, clueIndex) => ({
        id: `clue-${clueIndex + 1}`,
        label: `С подсказкой ${clueIndex + 1}`,
        ...buildDraftCombinedVariant(clueIndex + 1),
      })),
    ]

    return {
      game: {
        id: String(parsed?.game?.id || ''),
        name: String(parsed?.game?.name || ''),
        type: parsed?.game?.type === 'photo' ? 'photo' : 'classic',
        location: String(parsed?.game?.location || ''),
        status: String(parsed?.game?.status || ''),
        taskDuration: Number(parsed?.game?.taskDuration) || 3600,
        cluesDuration: Number(parsed?.game?.cluesDuration) || 1200,
        breakDuration: Number(parsed?.game?.breakDuration) || 0,
        tasksCount: tasks.length,
      },
      task: {
        index: safeTaskIndex,
        title: String(task?.title || ''),
        postMessage: String(task?.postMessage || ''),
        postMessageRich: String(task?.postMessageRich || ''),
        postMessageMedia: Array.isArray(task?.postMessageMedia)
          ? task.postMessageMedia
          : [],
        cluesCount: clues.length,
        displayMeta: buildTaskDisplayMeta(task),
      },
      variants,
    }
  }

  throw new Error('Не указан идентификатор игры или черновика')
}

const resolveSelectedVariantId = ({ data, variantParam }) => {
  const variants = Array.isArray(data?.variants) ? data.variants : []
  const firstVariantId = variants.length > 0 ? String(variants[0].id) : 'task'
  const preferredVariant = normalizeString(variantParam)
  const variantExists = variants.some(
    (variant) => String(variant?.id) === preferredVariant,
  )
  return variantExists && preferredVariant ? preferredVariant : firstVariantId
}

export default function GameTaskPreviewPageClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const gameId = searchParams.get('gameId')
  const draftKey = searchParams.get('draftKey')
  const variantParam = searchParams.get('variant')
  const taskIndexRaw = Number(searchParams.get('taskIndex') || 0)
  const taskIndex = Number.isFinite(taskIndexRaw) ? Math.max(0, taskIndexRaw) : 0

  const [selectedVariantId, setSelectedVariantId] = useState('task')
  const previewQueryKey = useMemo(
    () => buildPreviewQueryKey({ gameId, draftKey, taskIndex }),
    [draftKey, gameId, taskIndex],
  )
  const {
    data,
    error: queryError,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: previewQueryKey,
    queryFn: () => fetchTaskPreviewData({ gameId, draftKey, taskIndex }),
  })
  const error = queryError?.message || ''

  useEffect(() => {
    if (!data) return
    setSelectedVariantId(resolveSelectedVariantId({ data, variantParam }))
  }, [data, variantParam])

  const variants = useMemo(
    () => (Array.isArray(data?.variants) ? data.variants : []),
    [data?.variants],
  )

  const selectedVariant = useMemo(
    () =>
      variants.find((variant) => String(variant.id) === selectedVariantId) ||
      variants[0] ||
      null,
    [selectedVariantId, variants],
  )
  const backHref = useMemo(
    () =>
      buildBackHref({
        status: data?.game?.status,
        gameId: data?.game?.id,
      }),
    [data?.game?.id, data?.game?.status],
  )
  const selectedTaskHtml = useMemo(
    () => String(selectedVariant?.taskHtml || selectedVariant?.html || ''),
    [selectedVariant],
  )
  const selectedTaskText = useMemo(
    () => String(selectedVariant?.taskText || selectedVariant?.text || ''),
    [selectedVariant],
  )
  const selectedClues = useMemo(
    () => (Array.isArray(selectedVariant?.clues) ? selectedVariant.clues : []),
    [selectedVariant],
  )
  const postMessageHtml = useMemo(
    () =>
      String(data?.task?.postMessageRich || data?.task?.postMessage || '').trim(),
    [data?.task?.postMessage, data?.task?.postMessageRich],
  )
  const hasPostMessage = Boolean(postMessageHtml)

  const canGoPrev = taskIndex > 0
  const canGoNext =
    Number(data?.game?.tasksCount) > 0 &&
    taskIndex < Number(data?.game?.tasksCount) - 1

  const openTask = (nextTaskIndex) => {
    const params = new URLSearchParams()
    params.set('taskIndex', String(nextTaskIndex))
    if (selectedVariant?.id) {
      params.set('variant', String(selectedVariant.id))
    }

    if (gameId) {
      router.push(
        `/cabinet/admin/task-preview?gameId=${encodeURIComponent(gameId)}&${params.toString()}`,
      )
      return
    }
    if (draftKey) {
      router.push(
        `/cabinet/admin/task-preview?draftKey=${encodeURIComponent(draftKey)}&${params.toString()}`,
      )
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-4xl items-center justify-center px-4 py-6">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="rounded-xl border border-red-500/30 bg-red-900/20 p-6 text-center">
          <p className="mb-4 text-red-300">{error}</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-300 transition hover:bg-cyan-500/20"
          >
            Повторить
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="mx-auto max-w-4xl px-4 py-6">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <button
              type="button"
              onClick={() => {
                router.push(backHref)
              }}
              className="mb-2 text-sm text-slate-600 transition hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
            >
              ← Назад
            </button>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100 sm:text-2xl">
              Предпросмотр задания
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {data?.game?.name || 'Игра'} · {gameTypeLabel(data?.game?.type)}
            </p>
          </div>
        </div>

        <div className="mb-5 rounded-2xl border border-slate-300 bg-slate-100 p-4 dark:border-slate-700/60 dark:bg-slate-900/60">
          <div className="grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-end">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                Сценарий показа
              </span>
              <select
                value={selectedVariant?.id || ''}
                onChange={(event) => setSelectedVariantId(event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-cyan-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              >
                {variants.map((variant) => (
                  <option key={variant.id} value={variant.id}>
                    {variant.label}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={() => openTask(taskIndex - 1)}
              disabled={!canGoPrev}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 transition hover:border-cyan-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
            >
              ← Предыдущее
            </button>

            <button
              type="button"
              onClick={() => openTask(taskIndex + 1)}
              disabled={!canGoNext}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 transition hover:border-cyan-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
            >
              Следующее →
            </button>
          </div>
        </div>

        <section className="rounded-3xl bg-white p-6 shadow-lg dark:border dark:border-slate-800 dark:bg-slate-900 dark:shadow-slate-950/40">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-primary dark:text-white">
              Текущее задание
            </h2>
            <span className="rounded-full border border-cyan-300 bg-cyan-100 px-2.5 py-1 text-xs font-semibold text-cyan-800 dark:border-cyan-500/40 dark:bg-cyan-500/10 dark:text-cyan-200">
              {Number(data?.task?.index) + 1}. {data?.task?.title || 'Без названия'}
            </span>
          </div>
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-300">
            Предпросмотр в пользовательском формате. Таймер и ввод кода на этой
            странице отключены.
          </p>
          <div className="mt-4">
            <TaskDisplayWithClues
              taskHtml={selectedTaskHtml}
              taskText={selectedTaskText}
              clues={selectedClues}
              taskMeta={
                data?.task?.displayMeta && typeof data.task.displayMeta === 'object'
                  ? data.task.displayMeta
                  : null
              }
              directoryBase={`games/preview/task/${String(data?.game?.id || 'draft')}/${String(data?.task?.index || 0)}/${String(selectedVariant?.id || 'task')}`}
              taskClassName="text-base leading-relaxed text-gray-700 dark:text-slate-200"
              taskTextClassName="text-base leading-relaxed text-gray-700 dark:text-slate-200"
              cluesWrapperClassName="mt-4 space-y-4"
              clueCardClassName="rounded-2xl border border-cyan-300/70 bg-cyan-50/80 p-4 dark:border-cyan-500/40 dark:bg-cyan-500/10"
              clueTitleClassName="text-sm font-semibold text-cyan-900 dark:text-cyan-100"
              clueContentClassName="mt-2 text-base leading-relaxed text-gray-700 dark:text-slate-200"
              clueContentTextClassName="mt-2 text-base leading-relaxed text-gray-700 dark:text-slate-200"
              metaWrapperClassName="mt-4 space-y-1"
              metaTextClassName="text-base font-semibold leading-relaxed text-gray-700 dark:text-slate-200"
            />
          </div>
        </section>

        {hasPostMessage ? (
          <section className="mt-5 rounded-3xl border border-purple-500/30 bg-purple-500/10 p-6">
            <h3 className="text-lg font-semibold text-purple-100">
              Сообщение после задания
            </h3>
            <div className="mt-4">
              <RichTaskContentView
                html={postMessageHtml}
                text=""
                className="text-base leading-relaxed text-purple-100"
                textClassName="text-base leading-relaxed text-purple-100"
                directory={`games/preview/post-message/${String(data?.game?.id || 'draft')}/${String(data?.task?.index || 0)}`}
              />
            </div>
          </section>
        ) : null}
      </div>
    </>
  )
}
