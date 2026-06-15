'use client'

import PropTypes from 'prop-types'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowsRotate,
  faMoon,
  faSun,
} from '@fortawesome/free-solid-svg-icons'
import { useSession } from 'next-auth/react'

import { LOCATIONS } from '@server/serverConstants'
import normalizeAudioMessageHtml from '@helpers/normalizeAudioMessageHtml'
import { sendImage } from '@helpers/cloudinary'
import { GameMessageHistory } from '@components/game/GameMessageThread'
import RichTaskContentView from '@components/game/RichTaskContentView'
import TaskDisplayWithClues from '@components/game/TaskDisplayWithClues'
import LinkedMessageText from '@components/game/LinkedMessageText'
import Modal from '@components/Modal'

const PHOTO_ANSWER_ACCEPT_TYPES =
  'image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif,image/*'

const statusLabels = {
  active: 'Ещё не началась',
  started: 'В процессе',
  finished: 'Завершена',
  closed: 'Завершена',
}

const formatDateTime = (value, timeZone) => {
  if (!value) return null

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null

  const options = {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }

  if (timeZone) {
    options.timeZone = timeZone
  }

  try {
    return new Intl.DateTimeFormat('ru-RU', options).format(date)
  } catch {
    const fallbackOptions = { ...options }
    delete fallbackOptions.timeZone
    return new Intl.DateTimeFormat('ru-RU', fallbackOptions).format(date)
  }
}

const transformHtml = (value) => {
  if (!value) return ''

  const urlRegex = /(https?:\/\/[^\s<]+)/gi
  const parts = String(value).split(/(<[^>]+>)/g)
  let insideAnchor = false

  const transformed = parts
    .map((part) => {
      if (!part) return ''
      if (part.startsWith('<') && part.endsWith('>')) {
        if (/^<a\b/i.test(part)) {
          insideAnchor = true
        } else if (/^<\/a>/i.test(part)) {
          insideAnchor = false
        }
        return part
      }

      if (insideAnchor) {
        return part.replace(/\n/g, '<br />')
      }

      const withLinks = part.replace(urlRegex, (url) => {
        const href = url
        return `<a href="${href}" target="_blank" rel="noopener noreferrer">${href}</a>`
      })

      return withLinks.replace(/\n/g, '<br />')
    })
    .join('')

  return normalizeAudioMessageHtml(transformed)
}

const normalizeForComparison = (value) =>
  (value || '')
    .replace(/<br\s*\/?>(\s|\u00a0)*/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\r?\n/g, '\n')
    .replace(/\s+/g, ' ')
    .trim()

const collectResultMessages = ({
  result,
  normalizedTaskMessage,
  isBreakState,
  isGameCompletion,
}) => {
  if (!result) return []

  const rawMessages =
    Array.isArray(result.messages) && result.messages.length > 0
      ? result.messages
      : [result.message].filter(Boolean)

  if (rawMessages.length === 0) return []

  const seen = new Set()

  return rawMessages
    .filter((message) => {
      const normalized = normalizeForComparison(message)
      if (!normalized) return false
      if (normalizedTaskMessage && normalized === normalizedTaskMessage) {
        return false
      }
      if (isBreakState && /перерыв/i.test(normalized)) {
        return false
      }
      if (/(^|\s)введите\s+код/i.test(normalized)) {
        return false
      }
      if (isGameCompletion && /код\s+не\s+верен/i.test(normalized)) {
        return false
      }
      if (seen.has(normalized)) return false
      seen.add(normalized)
      return true
    })
    .map((message) => transformHtml(message))
}

const formatCountdownSeconds = (totalSeconds) => {
  if (!Number.isFinite(totalSeconds)) return '00:00:00'

  const safeSeconds = Math.max(totalSeconds, 0)
  const hours = Math.floor(safeSeconds / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)
  const seconds = safeSeconds % 60
  const pad = (num) => String(num).padStart(2, '0')

  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
}

const formatCodeTimeSeconds = (totalSeconds) => {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return ''

  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  const parts = []

  if (h > 0) parts.push(`${h} ч`)
  if (m > 0) parts.push(`${m} мин`)
  if (s > 0) parts.push(`${s} сек`)

  return parts.join(' ')
}

const formatCityName = (locationKey) => {
  if (!locationKey) return ''

  const town = LOCATIONS?.[locationKey]?.townRu
  if (!town) return locationKey

  const trimmed = town.trim()
  if (!trimmed) return locationKey

  return trimmed[0].toUpperCase() + trimmed.slice(1)
}

const formatMessageDateTime = (value) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

const adjustChatTextareaHeight = (textarea) => {
  if (!textarea) return

  textarea.style.height = 'auto'
  const styles = window.getComputedStyle(textarea)
  const lineHeight = Number.parseFloat(styles.lineHeight) || 20
  const paddingTop = Number.parseFloat(styles.paddingTop) || 0
  const paddingBottom = Number.parseFloat(styles.paddingBottom) || 0
  const maxHeight = lineHeight * 5 + paddingTop + paddingBottom
  const nextHeight = Math.min(textarea.scrollHeight, maxHeight)
  textarea.style.height = `${nextHeight}px`
  textarea.style.overflowY =
    textarea.scrollHeight > maxHeight ? 'auto' : 'hidden'
}

const ChatHeaderIcon = () => (
  <svg
    className="w-5 h-5"
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M4.5 5.8C4.5 4.81 5.31 4 6.3 4H13.7C14.69 4 15.5 4.81 15.5 5.8V10.4C15.5 11.39 14.69 12.2 13.7 12.2H9.1L5.7 15V12.2C5.03 12.2 4.5 11.67 4.5 11V5.8Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M7.2 7.4H12.8M7.2 9.6H10.8"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
)

const CloseIcon = () => (
  <svg
    className="w-4 h-4"
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M6 6L14 14M14 6L6 14"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
    />
  </svg>
)

const extractUrlCandidates = (value) => {
  if (!value) return []
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed ? [trimmed] : []
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => extractUrlCandidates(item))
  }
  if (typeof value === 'object') {
    return [
      value.url,
      value.secure_url,
      value.src,
      value.fileUrl,
      value.imageUrl,
      value.path,
      value.location,
      ...(Array.isArray(value.files) ? value.files : []),
      ...(Array.isArray(value.urls) ? value.urls : []),
      ...(Array.isArray(value.data) ? value.data : []),
    ].flatMap((item) => extractUrlCandidates(item))
  }
  return []
}

const normalizeTaskPayload = ({
  taskHtml = '',
  taskDisplayHtml = '',
  taskDisplayText = '',
  taskDisplayTaskHtml = '',
  taskDisplayTaskText = '',
  taskDisplayClues = [],
  taskDisplayMeta = null,
  taskState = 'idle',
  captainActions = null,
  result = null,
  postCompletionMessage = '',
}) => ({
  html: taskHtml || '',
  displayHtml: taskDisplayHtml || '',
  displayText: taskDisplayText || '',
  displayTaskHtml: taskDisplayTaskHtml || '',
  displayTaskText: taskDisplayTaskText || '',
  displayClues: Array.isArray(taskDisplayClues) ? taskDisplayClues : [],
  displayMeta:
    taskDisplayMeta && typeof taskDisplayMeta === 'object'
      ? taskDisplayMeta
      : null,
  state: taskState || 'idle',
  captainActions:
    captainActions && typeof captainActions === 'object'
      ? captainActions
      : null,
  result: result || null,
  postCompletionMessage: postCompletionMessage || '',
})

const areTaskPayloadsEqual = (prev, next) =>
  prev.html === next.html &&
  prev.displayHtml === next.displayHtml &&
  prev.displayText === next.displayText &&
  prev.displayTaskHtml === next.displayTaskHtml &&
  prev.displayTaskText === next.displayTaskText &&
  prev.displayClues === next.displayClues &&
  prev.displayMeta === next.displayMeta &&
  prev.state === next.state &&
  prev.captainActions === next.captainActions &&
  prev.result === next.result &&
  prev.postCompletionMessage === next.postCompletionMessage

const resolveThemePreference = () => {
  if (typeof window === 'undefined') {
    return 'light'
  }

  try {
    const storedTheme =
      window.localStorage?.getItem('cabinet-theme') ||
      window.localStorage?.getItem('aq-theme')
    if (storedTheme === 'light' || storedTheme === 'dark') {
      return storedTheme
    }
  } catch {
    // ignore inaccessible storage
  }

  const prefersDark = window.matchMedia?.(
    '(prefers-color-scheme: dark)',
  ).matches
  return prefersDark ? 'dark' : 'light'
}

const StoryMediaList = ({ media, directory }) => {
  const items = Array.isArray(media) ? media : []
  if (items.length === 0) {
    return null
  }

  return (
    <div className="grid gap-3 mt-4">
      {items.map((item, index) => {
        const url = typeof item?.url === 'string' ? item.url.trim() : ''
        if (!url) {
          return null
        }

        const title = typeof item?.title === 'string' ? item.title.trim() : ''
        const key = item?.id || `${directory}-${index}-${url}`
        const type = String(item?.type || '').toLowerCase()

        if (type === 'audio') {
          return (
            <div
              key={key}
              className="p-3 border rounded-2xl border-cyan-300/40 bg-cyan-50/70 dark:border-cyan-500/30 dark:bg-cyan-500/10"
            >
              {title ? (
                <p className="mb-2 text-sm font-semibold text-cyan-900 dark:text-cyan-100">
                  {title}
                </p>
              ) : null}
              <audio controls src={url} className="w-full" />
            </div>
          )
        }

        if (type === 'video') {
          return (
            <div
              key={key}
              className="p-3 border rounded-2xl border-slate-200 bg-slate-50/80 dark:border-slate-700 dark:bg-slate-800/70"
            >
              {title ? (
                <p className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-100">
                  {title}
                </p>
              ) : null}
              <video
                controls
                src={url}
                className="max-h-[420px] w-full rounded-xl"
              />
            </div>
          )
        }

        return (
          <figure
            key={key}
            className="p-3 border rounded-2xl border-slate-200 bg-slate-50/80 dark:border-slate-700 dark:bg-slate-800/70"
          >
            <img
              src={url}
              alt={title || 'Медиа story-квеста'}
              className="max-h-[420px] w-full rounded-xl object-contain"
            />
            {title ? (
              <figcaption className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                {title}
              </figcaption>
            ) : null}
          </figure>
        )
      })}
    </div>
  )
}

StoryMediaList.propTypes = {
  media: PropTypes.arrayOf(PropTypes.object),
  directory: PropTypes.string,
}

StoryMediaList.defaultProps = {
  media: [],
  directory: 'story-media',
}

const StoryQuestProcess = ({ gameId, teamId, isActive }) => {
  const [state, setState] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isMutating, setIsMutating] = useState(false)
  const [error, setError] = useState('')
  const [codeDrafts, setCodeDrafts] = useState({})
  const [openedClues, setOpenedClues] = useState({})

  const loadState = useCallback(async () => {
    if (!gameId || !teamId || !isActive) return false

    setIsLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ teamId })
      const response = await fetch(
        `/api/cabinet/games/${encodeURIComponent(gameId)}/story-state?${params.toString()}`,
      )
      const json = await response.json().catch(() => null)
      if (!response.ok || !json?.success) {
        throw new Error(json?.error || 'Не удалось загрузить story-квест')
      }
      setState(json.data || null)
      return true
    } catch (loadError) {
      setError(loadError?.message || 'Не удалось загрузить story-квест')
      return false
    } finally {
      setIsLoading(false)
    }
  }, [gameId, isActive, teamId])

  useEffect(() => {
    void loadState()
  }, [loadState])

  const postStoryAction = useCallback(
    async (endpoint, payload) => {
      if (isMutating) return null

      setIsMutating(true)
      setError('')
      try {
        const response = await fetch(
          `/api/cabinet/games/${encodeURIComponent(gameId)}/story/${endpoint}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              teamId,
              ...payload,
            }),
          },
        )
        const json = await response.json().catch(() => null)
        if (!response.ok || !json?.success) {
          throw new Error(json?.error || 'Не удалось выполнить действие')
        }

        const data = json.data || {}
        if (data.state) {
          setState(data.state)
        }
        return data
      } catch (actionError) {
        setError(actionError?.message || 'Не удалось выполнить действие')
        return null
      } finally {
        setIsMutating(false)
      }
    },
    [gameId, isMutating, teamId],
  )

  const handleCodeSubmit = useCallback(
    async (event, nodeId) => {
      event.preventDefault()
      const code = String(codeDrafts[nodeId] || '').trim()
      if (!code) return

      const data = await postStoryAction('code', { nodeId, code })
      if (data?.state) {
        setCodeDrafts((prev) => ({ ...prev, [nodeId]: '' }))
      }
    },
    [codeDrafts, postStoryAction],
  )

  const handleActionClick = useCallback(
    async ({ nodeId, actionId }) => {
      await postStoryAction('action', { nodeId, actionId })
    },
    [postStoryAction],
  )

  const handleClueClick = useCallback(
    async ({ nodeId, clueId }) => {
      const data = await postStoryAction('clue', { nodeId, clueId })
      if (data?.clue) {
        setOpenedClues((prev) => ({
          ...prev,
          [clueId]: data.clue,
        }))
      }
    },
    [postStoryAction],
  )

  const availableNodes = Array.isArray(state?.availableNodes)
    ? state.availableNodes
    : []
  const inventory = Array.isArray(state?.inventory) ? state.inventory : []
  const nodeLabel = state?.game?.storyConfig?.nodeLabel || 'Локация'
  const status = state?.progress?.status || 'not_started'
  const isFinished = status === 'completed' || status === 'failed'

  return (
    <section className="space-y-6">
      <div className="p-6 bg-white border shadow-lg rounded-3xl border-slate-200 dark:border-slate-800 dark:bg-slate-900 dark:shadow-slate-950/40">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-primary dark:text-white">
              Story-квест
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Команда видит только активные {nodeLabel.toLowerCase()} и текущий
              инвентарь.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {state?.progress?.score !== null &&
            state?.progress?.score !== undefined ? (
              <span className="px-3 py-1 text-sm font-semibold border rounded-full border-cyan-300 bg-cyan-50 text-cyan-800 dark:border-cyan-500/40 dark:bg-cyan-500/10 dark:text-cyan-100">
                Баллы: {state.progress.score}
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => void loadState()}
              disabled={isLoading || isMutating}
              className="inline-flex items-center rounded-full border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-600 transition hover:border-blue-400 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:border-blue-400 dark:hover:text-blue-300"
            >
              Обновить
            </button>
          </div>
        </div>

        {isLoading && !state ? (
          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
            Загружаем состояние...
          </p>
        ) : null}
        {error ? (
          <p className="px-3 py-2 mt-4 text-sm border rounded-xl border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
            {error}
          </p>
        ) : null}

        {state?.currentEnding ? (
          <div className="p-4 mt-5 border rounded-2xl border-emerald-300 bg-emerald-50 dark:border-emerald-500/35 dark:bg-emerald-500/10">
            <p className="text-xs font-semibold uppercase text-emerald-700 dark:text-emerald-200">
              {status === 'failed' ? 'Финал: не пройдено' : 'Финал'}
            </p>
            <h3 className="mt-1 text-lg font-semibold text-emerald-950 dark:text-emerald-50">
              {state.currentEnding.title || 'Концовка'}
            </h3>
            <RichTaskContentView
              html={state.currentEnding.descriptionRich || ''}
              text=""
              className="mt-3 text-base leading-relaxed text-emerald-950 dark:text-emerald-50"
              textClassName="mt-3 text-base leading-relaxed text-emerald-950 dark:text-emerald-50"
              directory={`games/story/${gameId}/${teamId}/ending/${state.currentEnding.id}`}
            />
            <StoryMediaList
              media={state.currentEnding.media}
              directory={`story-ending-${state.currentEnding.id}`}
            />
          </div>
        ) : null}
      </div>

      {inventory.length > 0 ? (
        <section className="p-6 bg-white border shadow-lg rounded-3xl border-slate-200 dark:border-slate-800 dark:bg-slate-900 dark:shadow-slate-950/40">
          <h2 className="text-lg font-semibold text-primary dark:text-white">
            Инвентарь
          </h2>
          <div className="grid gap-4 mt-4 sm:grid-cols-2">
            {inventory.map((item) => (
              <article
                key={item.itemId}
                className="p-4 border rounded-2xl border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/70"
              >
                <div className="flex gap-3">
                  {item.image ? (
                    <img
                      src={item.image}
                      alt={item.title || 'Предмет'}
                      className="object-cover w-16 h-16 shrink-0 rounded-xl"
                    />
                  ) : null}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-900 dark:text-slate-50">
                      {item.title || 'Предмет'}
                    </h3>
                    {item.descriptionRich ? (
                      <RichTaskContentView
                        html={item.descriptionRich}
                        text=""
                        className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-200"
                        textClassName="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-200"
                        directory={`games/story/${gameId}/${teamId}/items/${item.itemId}`}
                      />
                    ) : null}
                  </div>
                </div>
                <StoryMediaList
                  media={item.media}
                  directory={`story-item-${item.itemId}`}
                />
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {availableNodes.length > 0 ? (
        <div className="grid gap-6">
          {availableNodes.map((node) => {
            const nodeId = node.id
            const nodeClues = Array.isArray(node.clues) ? node.clues : []
            const nodeActions = Array.isArray(node.actions) ? node.actions : []

            return (
              <article
                key={nodeId}
                className="p-6 bg-white border shadow-lg rounded-3xl border-slate-200 dark:border-slate-800 dark:bg-slate-900 dark:shadow-slate-950/40"
              >
                <p className="text-xs font-semibold tracking-wide uppercase text-cyan-700 dark:text-cyan-300">
                  {nodeLabel}
                </p>
                <h2 className="mt-1 text-2xl font-semibold text-slate-950 dark:text-white">
                  {node.title || nodeLabel}
                </h2>
                <RichTaskContentView
                  html={node.descriptionRich || ''}
                  text=""
                  className="mt-4 text-base leading-relaxed text-slate-700 dark:text-slate-200"
                  textClassName="mt-4 text-base leading-relaxed text-slate-700 dark:text-slate-200"
                  directory={`games/story/${gameId}/${teamId}/nodes/${nodeId}`}
                />
                <StoryMediaList
                  media={node.media}
                  directory={`story-node-${nodeId}`}
                />

                {nodeClues.length > 0 ? (
                  <div className="mt-5 space-y-3">
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-100">
                      Подсказки
                    </h3>
                    {nodeClues.map((clue) => {
                      const openedClue = openedClues[clue.id]
                      const wasUsed = Boolean(clue.isUsed || openedClue)
                      return (
                        <div
                          key={clue.id}
                          className="p-4 border rounded-2xl border-cyan-300/50 bg-cyan-50/70 dark:border-cyan-500/30 dark:bg-cyan-500/10"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="font-semibold text-cyan-950 dark:text-cyan-50">
                                {clue.title || 'Подсказка'}
                              </p>
                              {clue.scorePenalty ? (
                                <p className="mt-1 text-xs text-cyan-700 dark:text-cyan-200/80">
                                  Штраф: {clue.scorePenalty} баллов
                                </p>
                              ) : null}
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                handleClueClick({ nodeId, clueId: clue.id })
                              }
                              disabled={isMutating || wasUsed}
                              className="rounded-full border border-cyan-300 bg-white px-3 py-1.5 text-sm font-semibold text-cyan-800 transition hover:border-cyan-500 hover:text-cyan-950 disabled:cursor-not-allowed disabled:opacity-60 dark:border-cyan-500/40 dark:bg-slate-900/70 dark:text-cyan-100 dark:hover:border-cyan-300"
                            >
                              {wasUsed ? 'Открыта' : 'Открыть'}
                            </button>
                          </div>
                          {openedClue ? (
                            <div className="mt-3">
                              <RichTaskContentView
                                html={openedClue.contentRich || ''}
                                text=""
                                className="text-sm leading-relaxed text-cyan-950 dark:text-cyan-50"
                                textClassName="text-sm leading-relaxed text-cyan-950 dark:text-cyan-50"
                                directory={`games/story/${gameId}/${teamId}/clues/${clue.id}`}
                              />
                              <StoryMediaList
                                media={openedClue.media}
                                directory={`story-clue-${clue.id}`}
                              />
                            </div>
                          ) : null}
                        </div>
                      )
                    })}
                  </div>
                ) : null}

                {nodeActions.length > 0 ? (
                  <div className="mt-5 space-y-3">
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-100">
                      Действия
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {nodeActions.map((action) => (
                        <button
                          key={action.id}
                          type="button"
                          onClick={() =>
                            handleActionClick({ nodeId, actionId: action.id })
                          }
                          disabled={isMutating || isFinished}
                          className="px-4 py-2 text-sm font-semibold text-white transition rounded-full bg-primary hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                          title={
                            Array.isArray(action.requiredItemIds) &&
                            action.requiredItemIds.length > 0
                              ? `Нужно: ${action.requiredItemIds.join(', ')}`
                              : undefined
                          }
                        >
                          {action.label || 'Выполнить действие'}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {!isFinished ? (
                  <form
                    className="flex flex-col gap-3 mt-5 sm:flex-row"
                    onSubmit={(event) => handleCodeSubmit(event, nodeId)}
                  >
                    <input
                      type="text"
                      value={codeDrafts[nodeId] || ''}
                      onChange={(event) =>
                        setCodeDrafts((prev) => ({
                          ...prev,
                          [nodeId]: event.target.value.slice(0, 80),
                        }))
                      }
                      placeholder="Введите код"
                      className="flex-1 min-w-0 px-4 py-3 text-base transition border border-gray-300 rounded-2xl focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-blue-400"
                    />
                    <button
                      type="submit"
                      disabled={
                        isMutating || !String(codeDrafts[nodeId] || '').trim()
                      }
                      className="px-6 py-3 text-sm font-semibold text-white transition rounded-full bg-primary hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Отправить
                    </button>
                  </form>
                ) : null}
              </article>
            )
          })}
        </div>
      ) : !isLoading && state ? (
        <section className="p-6 text-sm bg-white border shadow-lg rounded-3xl border-slate-200 text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:shadow-slate-950/40">
          {isFinished
            ? 'Квест завершен.'
            : 'Сейчас нет активных локаций. Дождитесь действия организатора или проверьте введенные коды.'}
        </section>
      ) : null}
    </section>
  )
}

StoryQuestProcess.propTypes = {
  gameId: PropTypes.string.isRequired,
  teamId: PropTypes.string.isRequired,
  isActive: PropTypes.bool,
}

StoryQuestProcess.defaultProps = {
  isActive: false,
}

function GameTeamPage({
  location,
  game,
  team,
  status,
  isGameStarted,
  isGameFinished,
  result,
  taskHtml,
  taskDisplayHtml,
  taskDisplayText,
  taskDisplayTaskHtml,
  taskDisplayTaskText,
  taskDisplayClues,
  taskDisplayMeta,
  taskState,
  captainActions,
  postCompletionMessage,
  error,
  session: initialSession,
  gameId,
  teamId,
  shouldClearMessageParam,
}) {
  const { data: session } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [theme, setTheme] = useState(null)
  const [answer, setAnswer] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isFinishingBreak, setIsFinishingBreak] = useState(false)
  const [isFinishBreakConfirmOpen, setIsFinishBreakConfirmOpen] =
    useState(false)
  const [isForcingClue, setIsForcingClue] = useState(false)
  const [isForceClueConfirmOpen, setIsForceClueConfirmOpen] = useState(false)
  const [isFailingTask, setIsFailingTask] = useState(false)
  const [isFailTaskConfirmOpen, setIsFailTaskConfirmOpen] = useState(false)
  const [isPhotoUploading, setIsPhotoUploading] = useState(false)
  const [photoUploadError, setPhotoUploadError] = useState('')
  const [isGameInfoCollapsed, setIsGameInfoCollapsed] = useState(false)
  const [
    isPostCompletionMessageCollapsed,
    setIsPostCompletionMessageCollapsed,
  ] = useState(false)
  const [gameMessages, setGameMessages] = useState([])
  const [canSendGameMessage, setCanSendGameMessage] = useState(false)
  const [isGameMessagesModalOpen, setIsGameMessagesModalOpen] = useState(false)
  const [gameMessagesLoading, setGameMessagesLoading] = useState(false)
  const [gameMessagesError, setGameMessagesError] = useState('')
  const [gameMessageDraft, setGameMessageDraft] = useState('')
  const [isSendingGameMessage, setIsSendingGameMessage] = useState(false)
  const [unreadAdminMessagesCount, setUnreadAdminMessagesCount] = useState(0)
  const [dismissedLatestAdminMessageId, setDismissedLatestAdminMessageId] =
    useState('')
  const taskContentRef = useRef(null)
  const gameMessagesListRef = useRef(null)
  const gameMessageTextareaRef = useRef(null)
  const refreshRequestedRef = useRef(0)
  const hasClearedMessageRef = useRef(false)
  const [stickyMessages, setStickyMessages] = useState([])
  const previousTaskStateRef = useRef(taskState || 'idle')
  const previousPostCompletionMessageRef = useRef('')
  const initialShouldClearMessages = Boolean(result?.shouldResetMessages)

  const [taskData, setTaskData] = useState(() =>
    normalizeTaskPayload({
      taskHtml,
      taskDisplayHtml,
      taskDisplayText,
      taskDisplayTaskHtml,
      taskDisplayTaskText,
      taskDisplayClues,
      taskDisplayMeta,
      taskState,
      captainActions,
      result,
      postCompletionMessage,
    }),
  )
  const [isTaskRefreshing, setIsTaskRefreshing] = useState(false)
  const [taskRefreshError, setTaskRefreshError] = useState(null)
  const countdownPanelRef = useRef(null)
  const countdownPanelLabelRef = useRef(null)
  const countdownPanelValueRef = useRef(null)
  const [
    shouldClearMessagesForActiveTask,
    setShouldClearMessagesForActiveTask,
  ] = useState(initialShouldClearMessages)
  const [lastResultSnapshot, setLastResultSnapshot] = useState(() => {
    if (initialShouldClearMessages) {
      return null
    }

    const initialMessages = collectResultMessages({
      result,
      normalizedTaskMessage: normalizeForComparison(taskHtml),
      isBreakState: taskState === 'break',
      isGameCompletion: isGameFinished || taskState === 'completed',
    })
    return initialMessages.length > 0 ? result : null
  })

  const resolvedSession = session ?? initialSession
  const isClient = typeof window !== 'undefined'

  const collapseStorageKey = useMemo(
    () => `aq-game-info-collapsed-${gameId}-${teamId}`,
    [gameId, teamId],
  )

  const effectiveTheme = theme ?? 'light'

  const updateTaskData = useCallback((payload) => {
    setTaskData((prev) => {
      const next = normalizeTaskPayload(payload)
      return areTaskPayloadsEqual(prev, next) ? prev : next
    })
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const rootElement = window.document?.documentElement
    if (!rootElement) return

    const applyTheme = (nextTheme) => {
      rootElement.classList.toggle('dark', nextTheme === 'dark')
      rootElement.setAttribute('data-theme', nextTheme)
    }

    if (theme == null) {
      const resolvedTheme = resolveThemePreference()
      applyTheme(resolvedTheme)

      setTheme(resolvedTheme)

      try {
        window.localStorage.setItem('cabinet-theme', resolvedTheme)
        window.localStorage.setItem('aq-theme', resolvedTheme)
      } catch {
        // ignore inaccessible storage
      }

      return
    }

    applyTheme(theme)

    try {
      window.localStorage.setItem('cabinet-theme', theme)
      window.localStorage.setItem('aq-theme', theme)
    } catch {
      // ignore inaccessible storage
    }
  }, [theme])

  useEffect(() => {
    setAnswer('')
  }, [pathname, searchParams])

  useEffect(() => {
    refreshRequestedRef.current = 0
  }, [taskData.html])

  // При получении result с сообщениями (ответ на ввод кода) — сохраняем в stickyMessages
  useEffect(() => {
    if (shouldClearMessageParam && result) {
      const msgs = collectResultMessages({
        result,
        normalizedTaskMessage: normalizeForComparison(taskHtml),
        isBreakState: taskState === 'break',
        isGameCompletion: isGameFinished || taskState === 'completed',
      })
      if (msgs.length > 0) {
        setStickyMessages(msgs)
      }
    }
  }, [shouldClearMessageParam, result, taskHtml, taskState, isGameFinished])

  useEffect(() => {
    updateTaskData({
      taskHtml,
      taskDisplayHtml,
      taskDisplayText,
      taskDisplayTaskHtml,
      taskDisplayTaskText,
      taskDisplayClues,
      taskDisplayMeta,
      taskState,
      captainActions,
      result,
      postCompletionMessage,
    })
    setShouldClearMessagesForActiveTask((prev) => {
      if (result?.shouldResetMessages) {
        return true
      }
      return prev
    })
  }, [
    postCompletionMessage,
    result,
    taskHtml,
    taskDisplayHtml,
    taskDisplayText,
    taskDisplayTaskHtml,
    taskDisplayTaskText,
    taskDisplayClues,
    taskDisplayMeta,
    taskState,
    captainActions,
    updateTaskData,
  ])

  useEffect(() => {
    const nextMessages = collectResultMessages({
      result,
      normalizedTaskMessage: normalizeForComparison(taskHtml),
      isBreakState: taskState === 'break',
      isGameCompletion: isGameFinished || taskState === 'completed',
    })
    if (result?.shouldResetMessages) {
      setLastResultSnapshot(null)
      return
    }

    setLastResultSnapshot(nextMessages.length > 0 ? result : null)
  }, [result, taskHtml, taskState, isGameFinished])

  useEffect(() => {
    if (!isClient) return
    if (!shouldClearMessageParam) return
    if (hasClearedMessageRef.current) return

    const cleanPath = `/game/${gameId}/process/${teamId}`
    hasClearedMessageRef.current = true
    router.replace(cleanPath, { scroll: false })
  }, [gameId, isClient, location, router, shouldClearMessageParam, teamId])

  useEffect(() => {
    if (!isClient) return

    const storedValue = window.localStorage.getItem(collapseStorageKey)
    setIsGameInfoCollapsed(storedValue === 'true')
  }, [collapseStorageKey, isClient])

  const handleThemeToggle = () => {
    setTheme((prev) => {
      const current = prev ?? 'light'
      return current === 'dark' ? 'light' : 'dark'
    })
  }

  const handleGameInfoToggle = () => {
    setIsGameInfoCollapsed((prev) => {
      const nextValue = !prev
      if (isClient) {
        if (nextValue) {
          window.localStorage.setItem(collapseStorageKey, 'true')
        } else {
          window.localStorage.removeItem(collapseStorageKey)
        }
      }
      return nextValue
    })
  }

  const handlePostCompletionMessageToggle = () => {
    setIsPostCompletionMessageCollapsed((prev) => !prev)
  }

  const handleTaskRefresh = useCallback(
    async ({ recordTimestamp = true } = {}) => {
      if (isTaskRefreshing) return null

      if (recordTimestamp) {
        refreshRequestedRef.current = Date.now()
        setStickyMessages([])
      }

      setTaskRefreshError(null)
      setIsTaskRefreshing(true)

      try {
        const response = await fetch('/api/webapp/game-task', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            location,
            gameId,
            teamId,
          }),
        })

        if (!response.ok) {
          const data = await response.json().catch(() => null)
          throw new Error(data?.error || 'Не удалось обновить задание')
        }

        const data = await response.json().catch(() => null)

        if (!data?.success) {
          throw new Error(data?.error || 'Не удалось обновить задание')
        }

        const payload = data.data || {}
        updateTaskData(payload)
        return true
      } catch (refreshError) {
        setTaskRefreshError(
          refreshError?.message || 'Не удалось обновить задание',
        )
        if (recordTimestamp) {
          refreshRequestedRef.current = 0
        }
        return false
      } finally {
        setIsTaskRefreshing(false)
      }
    },
    [gameId, isTaskRefreshing, location, teamId, updateTaskData],
  )

  const loadGameMessages = useCallback(
    async ({ markRead = false } = {}) => {
      if (!gameId || !teamId) return false

      setGameMessagesLoading(true)
      try {
        const params = new URLSearchParams({
          gameId,
          teamId,
        })
        if (!markRead) {
          params.set('markRead', 'false')
        }
        const response = await fetch(
          `/api/webapp/game-messages?${params.toString()}`,
        )
        const data = await response.json().catch(() => null)

        if (!response.ok || !data?.success) {
          throw new Error(data?.error || 'Не удалось загрузить сообщения')
        }

        const payload = data.data || {}
        setGameMessages(Array.isArray(payload.messages) ? payload.messages : [])
        setUnreadAdminMessagesCount(
          Math.max(0, Number(payload.unreadAdminMessagesCount || 0)),
        )
        setCanSendGameMessage(Boolean(payload.canSendToAdmin))
        setGameMessagesError('')
        return true
      } catch (messagesError) {
        setGameMessagesError(
          messagesError?.message || 'Не удалось загрузить сообщения',
        )
        return false
      } finally {
        setGameMessagesLoading(false)
      }
    },
    [gameId, teamId],
  )

  const handleSendGameMessage = useCallback(async () => {
    const body = gameMessageDraft.trim()
    if (!body || isSendingGameMessage) return

    setIsSendingGameMessage(true)
    try {
      const response = await fetch('/api/webapp/game-messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ gameId, teamId, body }),
      })
      const data = await response.json().catch(() => null)

      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Не удалось отправить сообщение')
      }

      setGameMessageDraft('')
      await loadGameMessages({ markRead: true })
    } catch (sendError) {
      setGameMessagesError(
        sendError?.message || 'Не удалось отправить сообщение',
      )
    } finally {
      setIsSendingGameMessage(false)
    }
  }, [gameId, gameMessageDraft, isSendingGameMessage, loadGameMessages, teamId])

  const handleGameMessageDraftChange = useCallback((event) => {
    setGameMessageDraft(event.target.value)
    adjustChatTextareaHeight(event.target)
  }, [])

  useEffect(() => {
    void loadGameMessages({ markRead: false })
  }, [loadGameMessages])

  useEffect(() => {
    if (!isGameMessagesModalOpen) return
    void loadGameMessages({ markRead: true })
  }, [isGameMessagesModalOpen, loadGameMessages])

  useEffect(() => {
    if (!gameId || !teamId) return undefined

    const intervalId = window.setInterval(() => {
      void loadGameMessages({ markRead: isGameMessagesModalOpen })
    }, 15000)

    return () => window.clearInterval(intervalId)
  }, [gameId, isGameMessagesModalOpen, loadGameMessages, teamId])

  useEffect(() => {
    if (!isGameMessagesModalOpen) return

    const frameId = window.requestAnimationFrame(() => {
      const list = gameMessagesListRef.current
      if (list) {
        list.scrollTop = list.scrollHeight
      }
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [gameMessages.length, isGameMessagesModalOpen])

  useEffect(() => {
    if (!isGameMessagesModalOpen) return

    const frameId = window.requestAnimationFrame(() => {
      adjustChatTextareaHeight(gameMessageTextareaRef.current)
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [gameMessageDraft, isGameMessagesModalOpen])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const intervalId = window.setInterval(() => {
      void loadGameMessages()
    }, 30000)

    return () => window.clearInterval(intervalId)
  }, [loadGameMessages])

  const handleLeaveGame = useCallback(() => {
    router.push(`/game/${gameId}`)
  }, [gameId, location, router])

  const handleSubmit = async (event) => {
    event.preventDefault()
    const trimmedAnswer = answer.trim().slice(0, 20)
    if (!trimmedAnswer) return

    setIsSubmitting(true)
    setStickyMessages([])
    try {
      hasClearedMessageRef.current = false
      const response = await fetch('/api/webapp/game-task', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          location,
          gameId,
          teamId,
          message: trimmedAnswer,
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.error || 'Не удалось отправить код')
      }

      const data = await response.json().catch(() => null)
      if (!data?.success) {
        throw new Error(data?.error || 'Не удалось отправить код')
      }

      updateTaskData(data.data || {})
      setAnswer('')
      setTaskRefreshError(null)
    } catch (submitError) {
      setTaskRefreshError(submitError?.message || 'Не удалось отправить код')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleFinishBreak = useCallback(async () => {
    if (isFinishingBreak || isTaskRefreshing) return

    setIsFinishingBreak(true)
    setStickyMessages([])
    setTaskRefreshError(null)

    try {
      const response = await fetch('/api/webapp/game-task', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          location,
          gameId,
          teamId,
          action: 'finishBreak',
        }),
      })

      const data = await response.json().catch(() => null)
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Не удалось завершить перерыв')
      }

      updateTaskData(data.data || {})
    } catch (finishError) {
      setTaskRefreshError(
        finishError?.message || 'Не удалось завершить перерыв',
      )
    } finally {
      setIsFinishingBreak(false)
    }
  }, [
    gameId,
    isFinishingBreak,
    isTaskRefreshing,
    location,
    teamId,
    updateTaskData,
  ])

  const handleFinishBreakRequest = useCallback(() => {
    if (isFinishingBreak || isTaskRefreshing) return
    setIsFinishBreakConfirmOpen(true)
  }, [isFinishingBreak, isTaskRefreshing])

  const handleFinishBreakConfirm = useCallback(() => {
    setIsFinishBreakConfirmOpen(false)
    void handleFinishBreak()
  }, [handleFinishBreak])

  const handleFinishBreakCancel = useCallback(() => {
    if (isFinishingBreak) return
    setIsFinishBreakConfirmOpen(false)
  }, [isFinishingBreak])

  const handleForceClue = useCallback(async () => {
    if (isForcingClue || isTaskRefreshing) return

    setIsForcingClue(true)
    setStickyMessages([])
    setTaskRefreshError(null)

    try {
      const response = await fetch('/api/webapp/game-task', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          location,
          gameId,
          teamId,
          action: 'forceClue',
        }),
      })

      const data = await response.json().catch(() => null)
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Не удалось получить подсказку')
      }

      updateTaskData(data.data || {})
    } catch (forceError) {
      setTaskRefreshError(
        forceError?.message || 'Не удалось получить подсказку',
      )
    } finally {
      setIsForcingClue(false)
    }
  }, [
    gameId,
    isForcingClue,
    isTaskRefreshing,
    location,
    teamId,
    updateTaskData,
  ])

  const handleForceClueRequest = useCallback(() => {
    if (isForcingClue || isTaskRefreshing) return
    setIsForceClueConfirmOpen(true)
  }, [isForcingClue, isTaskRefreshing])

  const handleForceClueConfirm = useCallback(() => {
    setIsForceClueConfirmOpen(false)
    void handleForceClue()
  }, [handleForceClue])

  const handleForceClueCancel = useCallback(() => {
    if (isForcingClue) return
    setIsForceClueConfirmOpen(false)
  }, [isForcingClue])

  const handleFailTask = useCallback(async () => {
    if (isFailingTask || isTaskRefreshing) return

    setIsFailingTask(true)
    setStickyMessages([])
    setTaskRefreshError(null)

    try {
      const response = await fetch('/api/webapp/game-task', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          location,
          gameId,
          teamId,
          action: 'failTask',
        }),
      })

      const data = await response.json().catch(() => null)
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Не удалось слить задание')
      }

      updateTaskData(data.data || {})
    } catch (failError) {
      setTaskRefreshError(failError?.message || 'Не удалось слить задание')
    } finally {
      setIsFailingTask(false)
    }
  }, [
    gameId,
    isFailingTask,
    isTaskRefreshing,
    location,
    teamId,
    updateTaskData,
  ])

  const handleFailTaskRequest = useCallback(() => {
    if (isFailingTask || isTaskRefreshing) return
    setIsFailTaskConfirmOpen(true)
  }, [isFailingTask, isTaskRefreshing])

  const handleFailTaskConfirm = useCallback(() => {
    setIsFailTaskConfirmOpen(false)
    void handleFailTask()
  }, [handleFailTask])

  const handleFailTaskCancel = useCallback(() => {
    if (isFailingTask) return
    setIsFailTaskConfirmOpen(false)
  }, [isFailingTask])

  const submitPhotoAnswerUrl = async (photoUrl) => {
    const response = await fetch('/api/webapp/game-task', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        location,
        gameId,
        teamId,
        message: photoUrl,
      }),
    })

    if (!response.ok) {
      const data = await response.json().catch(() => null)
      throw new Error(data?.error || 'Не удалось отправить фото')
    }

    return response.json()
  }

  const handlePhotoAnswerUpload = async (event) => {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    if (files.length === 0 || isPhotoUploading) return

    setIsPhotoUploading(true)
    setIsSubmitting(true)
    setPhotoUploadError('')
    setStickyMessages([])

    try {
      let lastResponseData = null

      for (const file of files) {
        const uploadResult = await sendImage(
          file,
          null,
          `game-photo-answers/${gameId}/${teamId}`,
          null,
          'actquest',
          (message) => setPhotoUploadError(message || 'Ошибка загрузки фото'),
        )

        const uploadedUrls = Array.from(
          new Set(
            extractUrlCandidates(uploadResult)
              .map((value) => (typeof value === 'string' ? value.trim() : ''))
              .filter(Boolean),
          ),
        )

        if (uploadedUrls.length === 0) {
          throw new Error('Сервер не вернул ссылку на фото')
        }

        for (const photoUrl of uploadedUrls) {
          const data = await submitPhotoAnswerUrl(photoUrl)
          lastResponseData = data?.data || lastResponseData
        }
      }

      if (lastResponseData) {
        updateTaskData(lastResponseData)
      }
      setTaskRefreshError(null)
    } catch (uploadError) {
      const message = uploadError?.message || 'Не удалось отправить фото'
      setPhotoUploadError(message)
      setTaskRefreshError(message)
    } finally {
      setIsPhotoUploading(false)
      setIsSubmitting(false)
    }
  }

  const statusLabel = statusLabels[status] ?? 'Статус неизвестен'
  const {
    html: currentTaskHtml,
    displayHtml: currentTaskDisplayHtml,
    displayText: currentTaskDisplayText,
    displayTaskHtml: currentTaskDisplayTaskHtml,
    displayTaskText: currentTaskDisplayTaskText,
    displayClues: currentTaskDisplayClues,
    displayMeta: currentTaskDisplayMeta,
    state: currentTaskState,
    captainActions: currentCaptainActions,
    result: currentResult,
    postCompletionMessage: currentPostCompletionMessage,
  } = taskData
  const locationTimeZone = useMemo(
    () => LOCATIONS?.[location]?.timeZone || null,
    [location],
  )
  const plannedStart = useMemo(
    () => formatDateTime(game?.dateStart, locationTimeZone),
    [game?.dateStart, locationTimeZone],
  )
  const actualStart = useMemo(
    () => formatDateTime(game?.dateStartFact, locationTimeZone),
    [game?.dateStartFact, locationTimeZone],
  )
  const actualFinish = useMemo(
    () =>
      isGameFinished
        ? formatDateTime(game?.dateEndFact, locationTimeZone)
        : null,
    [game?.dateEndFact, isGameFinished, locationTimeZone],
  )
  const cityName = useMemo(() => formatCityName(location), [location])
  const gameTypeLabel = useMemo(() => {
    const typeValue = String(game?.type || '')
      .trim()
      .toLowerCase()
    if (typeValue === 'story') {
      return 'Story-квест'
    }
    return typeValue === 'photo' ? 'Фотоквест' : 'Автоквест'
  }, [game?.type])
  const isPhotoGame =
    String(game?.type || '')
      .trim()
      .toLowerCase() === 'photo'
  const isStoryGame =
    String(game?.type || '')
      .trim()
      .toLowerCase() === 'story'

  const formattedTaskMessage = useMemo(
    () => transformHtml(currentTaskHtml ?? ''),
    [currentTaskHtml],
  )
  const visibleTaskHtml = useMemo(
    () => transformHtml(currentTaskDisplayHtml || ''),
    [currentTaskDisplayHtml],
  )
  const visibleTaskText = useMemo(
    () => String(currentTaskDisplayText || ''),
    [currentTaskDisplayText],
  )
  const visibleTaskOnlyHtml = useMemo(
    () => transformHtml(currentTaskDisplayTaskHtml || ''),
    [currentTaskDisplayTaskHtml],
  )
  const visibleTaskOnlyText = useMemo(
    () => String(currentTaskDisplayTaskText || ''),
    [currentTaskDisplayTaskText],
  )
  const visibleTaskClues = useMemo(
    () =>
      Array.isArray(currentTaskDisplayClues) ? currentTaskDisplayClues : [],
    [currentTaskDisplayClues],
  )
  const acceptedTaskCodes = useMemo(() => {
    if (!currentTaskDisplayMeta || typeof currentTaskDisplayMeta !== 'object') {
      return []
    }

    const rawMain = Array.isArray(currentTaskDisplayMeta.acceptedMainCodes)
      ? currentTaskDisplayMeta.acceptedMainCodes
      : []
    const normalizeCodeValue = (value) => {
      if (typeof value === 'string') {
        return value.trim()
      }
      if (typeof value === 'number' && Number.isFinite(value)) {
        return String(value).trim()
      }
      if (value && typeof value === 'object') {
        const codeValue = value.code
        if (typeof codeValue === 'string') {
          return codeValue.trim()
        }
        if (typeof codeValue === 'number' && Number.isFinite(codeValue)) {
          return String(codeValue).trim()
        }
      }
      return ''
    }
    const raw = rawMain

    if (!Array.isArray(raw) || raw.length === 0) {
      return []
    }

    const unique = new Set()
    return raw
      .map((value) => normalizeCodeValue(value))
      .filter((value) => {
        if (!value || unique.has(value)) {
          return false
        }
        unique.add(value)
        return true
      })
  }, [currentTaskDisplayMeta])
  const acceptedBonusCodeItems = useMemo(() => {
    if (!currentTaskDisplayMeta || typeof currentTaskDisplayMeta !== 'object') {
      return []
    }
    const raw = Array.isArray(currentTaskDisplayMeta.acceptedBonusCodeItems)
      ? currentTaskDisplayMeta.acceptedBonusCodeItems
      : []
    return raw
      .map((item) => {
        const code = typeof item?.code === 'string' ? item.code.trim() : ''
        const description =
          typeof item?.description === 'string' ? item.description.trim() : ''
        const value = Number(item?.value)
        if (!code) return null
        return { code, description, value: Number.isFinite(value) ? value : 0 }
      })
      .filter(Boolean)
  }, [currentTaskDisplayMeta])
  const acceptedPenaltyCodeItems = useMemo(() => {
    if (!currentTaskDisplayMeta || typeof currentTaskDisplayMeta !== 'object') {
      return []
    }
    const raw = Array.isArray(currentTaskDisplayMeta.acceptedPenaltyCodeItems)
      ? currentTaskDisplayMeta.acceptedPenaltyCodeItems
      : []
    return raw
      .map((item) => {
        const code = typeof item?.code === 'string' ? item.code.trim() : ''
        const description =
          typeof item?.description === 'string' ? item.description.trim() : ''
        const value = Number(item?.value)
        if (!code) return null
        return { code, description, value: Number.isFinite(value) ? value : 0 }
      })
      .filter(Boolean)
  }, [currentTaskDisplayMeta])
  const currentTaskNumber = useMemo(() => {
    const rawFromMeta = Number(currentTaskDisplayMeta?.taskIndex)
    if (Number.isFinite(rawFromMeta)) {
      return Math.max(1, Math.floor(rawFromMeta) + 1)
    }
    const rawFromTeam = Number(team?.activeNum)
    if (Number.isFinite(rawFromTeam)) {
      return Math.max(1, Math.floor(rawFromTeam) + 1)
    }
    return 1
  }, [currentTaskDisplayMeta?.taskIndex, team?.activeNum])
  const remainingMainCodesCount = useMemo(() => {
    if (acceptedTaskCodes.length < 1) {
      return null
    }

    const mainCodesCountRaw = Number(currentTaskDisplayMeta?.mainCodesCount)
    const mainCodesCount = Number.isFinite(mainCodesCountRaw)
      ? Math.max(0, Math.floor(mainCodesCountRaw))
      : 0

    const requiredCodesSource = currentTaskDisplayMeta?.requiredCodesCount
    const hasExplicitRequiredCodes =
      requiredCodesSource !== null &&
      requiredCodesSource !== undefined &&
      requiredCodesSource !== ''
    const requiredCodesRaw = Number(requiredCodesSource)
    const requiredCodesCount =
      hasExplicitRequiredCodes && Number.isFinite(requiredCodesRaw)
        ? Math.max(0, Math.floor(requiredCodesRaw))
        : mainCodesCount

    const cappedRequiredCodes =
      mainCodesCount > 0
        ? Math.min(requiredCodesCount, mainCodesCount)
        : requiredCodesCount

    const remaining = Math.max(
      cappedRequiredCodes - acceptedTaskCodes.length,
      0,
    )
    return remaining > 0 ? remaining : null
  }, [
    acceptedTaskCodes.length,
    currentTaskDisplayMeta?.mainCodesCount,
    currentTaskDisplayMeta?.requiredCodesCount,
  ])

  const isBreakState = currentTaskState === 'break'
  const canCaptainFinishBreak =
    isBreakState && Boolean(currentCaptainActions?.canFinishBreak)
  const canCaptainForceClue =
    !isBreakState &&
    !isGameFinished &&
    Boolean(currentCaptainActions?.canForceClue)
  const canCaptainFailTask =
    !isBreakState &&
    !isGameFinished &&
    Boolean(currentCaptainActions?.canFailTask)
  const isCompletedState = currentTaskState === 'completed'
  const isGameCompletion = isGameFinished || isCompletedState
  const fallbackTaskHtml = useMemo(
    () => (isBreakState ? formattedTaskMessage : ''),
    [formattedTaskMessage, isBreakState],
  )
  const resolvedTaskHtml = useMemo(
    () => visibleTaskOnlyHtml || visibleTaskHtml || fallbackTaskHtml,
    [visibleTaskOnlyHtml, visibleTaskHtml, fallbackTaskHtml],
  )
  const resolvedTaskText = useMemo(
    () => visibleTaskOnlyText || visibleTaskText,
    [visibleTaskOnlyText, visibleTaskText],
  )
  const normalizedTaskMessage = useMemo(
    () => normalizeForComparison(currentTaskHtml),
    [currentTaskHtml],
  )

  const activeTaskResultMessages = useMemo(
    () =>
      collectResultMessages({
        result: currentResult,
        normalizedTaskMessage,
        isBreakState,
        isGameCompletion,
      }),
    [currentResult, normalizedTaskMessage, isBreakState, isGameCompletion],
  )

  const visibleActiveTaskMessages = useMemo(
    () => (shouldClearMessagesForActiveTask ? [] : activeTaskResultMessages),
    [shouldClearMessagesForActiveTask, activeTaskResultMessages],
  )

  useEffect(() => {
    if (currentResult?.shouldResetMessages) {
      if (!shouldClearMessagesForActiveTask) {
        setShouldClearMessagesForActiveTask(true)
      }
      return
    }

    if (currentTaskState !== 'active') {
      if (shouldClearMessagesForActiveTask) {
        setShouldClearMessagesForActiveTask(false)
      }
      return
    }

    if (
      currentResult &&
      shouldClearMessagesForActiveTask &&
      activeTaskResultMessages.length > 0
    ) {
      setShouldClearMessagesForActiveTask(false)
    }
  }, [
    currentResult,
    currentTaskState,
    activeTaskResultMessages,
    shouldClearMessagesForActiveTask,
  ])

  useEffect(() => {
    if (shouldClearMessagesForActiveTask) {
      setLastResultSnapshot(null)
      return
    }

    if (visibleActiveTaskMessages.length > 0 && currentResult) {
      setLastResultSnapshot(currentResult)
    } else if (currentResult && visibleActiveTaskMessages.length === 0) {
      setLastResultSnapshot(null)
    }
  }, [
    currentResult,
    visibleActiveTaskMessages,
    shouldClearMessagesForActiveTask,
  ])

  useEffect(() => {
    const previousState = previousTaskStateRef.current
    if (previousState !== currentTaskState) {
      if (currentTaskState === 'active' && previousState !== 'active') {
        setShouldClearMessagesForActiveTask(true)
        setLastResultSnapshot(null)
      }
      if (currentTaskState === 'completed' || currentTaskState === 'break') {
        setStickyMessages([])
      }
      previousTaskStateRef.current = currentTaskState
    }
  }, [currentTaskState])

  const fallbackResultMessages = useMemo(() => {
    if (currentResult || shouldClearMessagesForActiveTask) {
      return []
    }

    return collectResultMessages({
      result: lastResultSnapshot,
      normalizedTaskMessage,
      isBreakState,
      isGameCompletion,
    })
  }, [
    currentResult,
    lastResultSnapshot,
    normalizedTaskMessage,
    isBreakState,
    isGameCompletion,
    shouldClearMessagesForActiveTask,
  ])

  const resultMessages =
    visibleActiveTaskMessages.length > 0
      ? visibleActiveTaskMessages
      : stickyMessages.length > 0
        ? stickyMessages
        : fallbackResultMessages

  const postCompletionMessageHtml = useMemo(() => {
    if (!currentPostCompletionMessage) return ''

    // Проверяем, есть ли в строке хоть какой-то контент (текст или HTML-теги).
    // normalizeForComparison удаляет ВСЕ html-теги, поэтому для сообщения,
    // содержащего только <img> (без текста), вернёт пустую строку,
    // и картинка не покажется. Используем проверку на наличие любых
    // непробельных символов в исходной строке.
    const hasAnyContent = /[^\s]/.test(currentPostCompletionMessage)
    if (!hasAnyContent) return ''

    return transformHtml(currentPostCompletionMessage)
  }, [currentPostCompletionMessage])

  const shouldRenderPostCompletionMessage =
    Boolean(postCompletionMessageHtml) && !isStoryGame

  useEffect(() => {
    if (!shouldRenderPostCompletionMessage) {
      previousPostCompletionMessageRef.current = ''
      setIsPostCompletionMessageCollapsed(false)
      return
    }

    const normalizedMessage = postCompletionMessageHtml || ''
    const messageStateKey = `${isGameCompletion ? 'completed' : isBreakState ? 'break' : 'task'}:${normalizedMessage}`
    if (
      normalizedMessage &&
      previousPostCompletionMessageRef.current !== messageStateKey
    ) {
      setIsPostCompletionMessageCollapsed(!(isBreakState || isGameCompletion))
    }

    previousPostCompletionMessageRef.current = messageStateKey
  }, [
    isBreakState,
    isGameCompletion,
    postCompletionMessageHtml,
    shouldRenderPostCompletionMessage,
  ])

  const displayedResultMessages = useMemo(() => {
    const unique = new Set()
    const output = []

    const baseMessages = shouldClearMessagesForActiveTask ? [] : resultMessages

    baseMessages.forEach((message) => {
      if (!message) return
      if (unique.has(message)) return
      unique.add(message)
      output.push(message)
    })

    return output
  }, [resultMessages, shouldClearMessagesForActiveTask])

  const latestUnreadAdminMessage = useMemo(() => {
    const unreadAdminMessages = gameMessages.filter(
      (message) =>
        message?.direction === 'admin_to_team' && !message?.userReadAt,
    )
    return unreadAdminMessages.length > 0
      ? unreadAdminMessages[unreadAdminMessages.length - 1]
      : null
  }, [gameMessages])

  const hasUnreadAdminMessages = gameMessages.some(
    (message) => message?.direction === 'admin_to_team' && !message?.userReadAt,
  )
  const shouldShowLatestAdminMessage =
    Boolean(latestUnreadAdminMessage) &&
    hasUnreadAdminMessages &&
    latestUnreadAdminMessage.id !== dismissedLatestAdminMessageId
  const displayedAdminMessage = latestUnreadAdminMessage
  const shouldShowGameMessagesBlock = shouldShowLatestAdminMessage
  const shouldShowLastMessage =
    displayedResultMessages.length > 0 && !isStoryGame
  const shouldShowAnswerForm =
    !isStoryGame && !isGameCompletion && !isBreakState
  const shouldShowGameCompletedBlock = !isStoryGame && isGameCompletion
  const shouldShowCurrentTaskBlock =
    Boolean(
      resolvedTaskHtml || resolvedTaskText || visibleTaskClues.length > 0,
    ) &&
    !shouldShowGameCompletedBlock &&
    !isStoryGame
  const statusNotice = useMemo(() => {
    if (error) return null
    if (!isGameStarted && status === 'active') {
      return 'Игра ещё не началась. Ожидайте старта организатора.'
    }
    if (isGameFinished && currentTaskState !== 'completed') {
      return 'Игра завершена. Проверьте результаты в кабинете.'
    }
    return null
  }, [currentTaskState, error, isGameFinished, isGameStarted, status])

  useEffect(() => {
    if (!isClient) return
    const container = taskContentRef.current
    if (!container) return

    const nodes = Array.from(
      container.querySelectorAll('[data-task-countdown]'),
    )

    if (nodes.length === 0) {
      if (countdownPanelRef.current) {
        countdownPanelRef.current.style.display = 'none'
      }
      return
    }

    let countdowns = nodes.map((element) => {
      const targetAttr = element.getAttribute('data-target')
      const secondsAttr = element.getAttribute('data-seconds')
      const refreshAttr = element.getAttribute('data-refresh-on-complete')
      const target = Number(targetAttr)
      const seconds = Number(secondsAttr)

      return {
        element,
        target: Number.isFinite(target) ? target : null,
        initialSeconds: Number.isFinite(seconds) ? seconds : null,
        refreshOnComplete: refreshAttr === 'true' || refreshAttr === '1',
        startTimestamp: Date.now(),
      }
    })

    const updateCountdowns = () => {
      const now = Date.now()
      let panelState = null

      countdowns = countdowns.map((item) => {
        const { element, target, initialSeconds, startTimestamp } = item
        let remainingMs = null

        // В приоритете считаем от initialSeconds + локально прошедшего времени.
        // Это устойчиво к рассинхрону часов между устройством и сервером.
        if (Number.isFinite(initialSeconds)) {
          const base = Number.isFinite(startTimestamp) ? startTimestamp : now
          remainingMs = initialSeconds * 1000 - (now - base)
        } else if (Number.isFinite(target)) {
          remainingMs = target - now
        }

        const remainingSeconds = Math.max(
          Math.floor((remainingMs ?? 0) / 1000),
          0,
        )

        element.textContent = formatCountdownSeconds(remainingSeconds)

        if (!panelState) {
          const countdownType = String(
            element.getAttribute('data-task-countdown') || '',
          )
            .trim()
            .toLowerCase()
          const label =
            countdownType === 'hint'
              ? 'До следующей подсказки'
              : countdownType === 'break'
                ? 'До окончания перерыва'
                : 'До завершения задания'

          panelState = {
            label,
            value: formatCountdownSeconds(remainingSeconds),
          }
        }

        if (item.refreshOnComplete && remainingSeconds <= 0) {
          const lastRefreshAt = refreshRequestedRef.current || 0
          const MIN_REFRESH_INTERVAL = 3000

          if (now - lastRefreshAt >= MIN_REFRESH_INTERVAL) {
            const triggerRefresh = async () => {
              refreshRequestedRef.current = now
              const success = await handleTaskRefresh({
                recordTimestamp: false,
              })

              if (success === false) {
                const fallbackPath =
                  pathname && pathname.length > 0
                    ? pathname
                    : `/game/${gameId}/process/${teamId}`
                router.replace(fallbackPath, { scroll: false })
              }
            }

            void triggerRefresh()
          }
        }

        return {
          ...item,
          startTimestamp: Number.isFinite(startTimestamp)
            ? startTimestamp
            : now,
        }
      })

      if (countdownPanelRef.current) {
        if (panelState) {
          countdownPanelRef.current.style.display = ''
          if (countdownPanelLabelRef.current) {
            countdownPanelLabelRef.current.textContent = panelState.label + ':'
          }
          if (countdownPanelValueRef.current) {
            countdownPanelValueRef.current.textContent = panelState.value
          }
        } else {
          countdownPanelRef.current.style.display = 'none'
        }
      }
    }

    updateCountdowns()
    const intervalId = window.setInterval(updateCountdowns, 1000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [
    formattedTaskMessage,
    handleTaskRefresh,
    isClient,
    router,
    pathname,
    location,
    gameId,
    teamId,
  ])

  return (
    <>
      <div className="min-h-screen bg-[#F5F6F8] pb-16 transition-colors dark:bg-slate-950 dark:text-slate-100">
        <header className="transition-colors bg-white border-b border-gray-200 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between max-w-6xl px-4 py-5 mx-auto">
            <Link
              href="/"
              className="text-2xl font-bold transition-colors text-primary dark:text-white"
            >
              ActQuest
            </Link>
            <nav className="flex items-center gap-6 text-sm font-semibold text-gray-600 dark:text-slate-300">
              {/**
               * <a
               *   href="https://t.me/ActQuest_bot"
               *   className="transition hover:text-primary dark:hover:text-white"
               *   target="_blank"
               *   rel="noreferrer"
               * >
               *   Бот в Telegram
               * </a>
               */}
            </nav>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsGameMessagesModalOpen(true)}
                className="relative inline-flex items-center justify-center w-10 h-10 text-gray-600 transition border border-gray-300 rounded-full hover:border-blue-400 hover:text-blue-600 dark:border-slate-700 dark:text-slate-200 dark:hover:border-blue-400 dark:hover:text-blue-300"
                aria-label="Открыть переписку с организатором"
                title="Переписка с организатором"
              >
                <ChatHeaderIcon />
                {unreadAdminMessagesCount > 0 ? (
                  <span className="absolute -right-1.5 -top-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white shadow">
                    {unreadAdminMessagesCount > 99
                      ? '99+'
                      : unreadAdminMessagesCount}
                  </span>
                ) : null}
              </button>
              <button
                type="button"
                onClick={handleThemeToggle}
                className="inline-flex items-center justify-center w-10 h-10 text-gray-600 transition border border-gray-300 rounded-full hover:border-blue-400 hover:text-blue-600 dark:border-slate-700 dark:text-slate-200 dark:hover:border-blue-400 dark:hover:text-blue-300"
                aria-label={
                  effectiveTheme === 'dark'
                    ? 'Включить светлую тему'
                    : 'Включить тёмную тему'
                }
                title={
                  effectiveTheme === 'dark' ? 'Светлая тема' : 'Тёмная тема'
                }
              >
                <FontAwesomeIcon
                  icon={effectiveTheme === 'dark' ? faSun : faMoon}
                  className="w-4 h-4"
                />
              </button>
              {resolvedSession ? (
                <button
                  type="button"
                  onClick={handleLeaveGame}
                  className="px-4 py-2 text-sm font-semibold text-gray-600 transition border border-gray-300 rounded-full hover:border-blue-400 hover:text-blue-600 dark:border-slate-700 dark:text-slate-200 dark:hover:border-blue-400 dark:hover:text-blue-300"
                >
                  Выйти из игры
                </button>
              ) : null}
            </div>
          </div>
        </header>

        <main className="px-4">
          <div className="flex flex-col w-full max-w-5xl gap-8 mx-auto mt-10">
            {status !== 'started' ? (
              <section className="flex flex-col gap-6 p-6 bg-white shadow-lg rounded-3xl dark:bg-slate-900 dark:border dark:border-slate-800 dark:shadow-slate-950/40">
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                        <h1 className="text-2xl font-semibold text-primary dark:text-white">
                          {game?.name || 'Игра'}
                        </h1>
                        <span className="px-3 py-1 text-xs font-semibold text-blue-700 uppercase bg-blue-100 border border-blue-200 rounded-full dark:bg-blue-500/10 dark:border-blue-400/40 dark:text-blue-200">
                          {statusLabel}
                        </span>
                      </div>
                      {!isGameInfoCollapsed ? (
                        <div className="grid gap-3 text-sm text-gray-600 sm:grid-cols-2 dark:text-slate-300">
                          <div className="flex flex-col">
                            <span className="text-xs text-gray-400 uppercase dark:text-slate-500">
                              ГОРОД
                            </span>
                            <span className="font-medium text-gray-800 dark:text-slate-100">
                              {cityName || location}
                            </span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-xs text-gray-400 uppercase dark:text-slate-500">
                              Команда
                            </span>
                            <span className="font-medium text-gray-800 dark:text-slate-100">
                              {team?.name || 'Команда без названия'}
                            </span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-xs text-gray-400 uppercase dark:text-slate-500">
                              Тип квеста
                            </span>
                            <span className="font-medium text-gray-800 dark:text-slate-100">
                              {gameTypeLabel}
                            </span>
                          </div>
                          {plannedStart ? (
                            <div className="flex flex-col">
                              <span className="text-xs text-gray-400 uppercase dark:text-slate-500">
                                Планируемый старт
                              </span>
                              <span className="font-medium text-gray-800 dark:text-slate-100">
                                {plannedStart}
                              </span>
                            </div>
                          ) : null}
                          {actualStart ? (
                            <div className="flex flex-col">
                              <span className="text-xs text-gray-400 uppercase dark:text-slate-500">
                                Фактический старт
                              </span>
                              <span className="font-medium text-gray-800 dark:text-slate-100">
                                {actualStart}
                              </span>
                            </div>
                          ) : null}
                          {actualFinish ? (
                            <div className="flex flex-col">
                              <span className="text-xs text-gray-400 uppercase dark:text-slate-500">
                                Фактическое завершение
                              </span>
                              <span className="font-medium text-gray-800 dark:text-slate-100">
                                {actualFinish}
                              </span>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={handleGameInfoToggle}
                      className="flex items-center self-start justify-center p-2 text-gray-600 transition border border-gray-300 rounded-full hover:border-blue-400 hover:text-blue-600 dark:border-slate-700 dark:text-slate-200 dark:hover:border-blue-400 dark:hover:text-blue-300"
                      aria-label={
                        isGameInfoCollapsed
                          ? 'Развернуть информацию об игре'
                          : 'Свернуть информацию об игре'
                      }
                      title={
                        isGameInfoCollapsed
                          ? 'Развернуть информацию об игре'
                          : 'Свернуть информацию об игре'
                      }
                    >
                      <svg
                        className="w-5 h-5"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d={
                            isGameInfoCollapsed
                              ? 'M6 9l6 6 6-6'
                              : 'M6 15l6-6 6 6'
                          }
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      <span className="sr-only">
                        {isGameInfoCollapsed
                          ? 'Развернуть информацию об игре'
                          : 'Свернуть информацию об игре'}
                      </span>
                    </button>
                  </div>
                </div>
              </section>
            ) : null}

            {shouldRenderPostCompletionMessage && isGameCompletion ? (
              <section className="p-6 border border-purple-200 shadow-lg bg-purple-50 rounded-3xl dark:bg-purple-500/10 dark:border-purple-500/30 dark:shadow-slate-950/40">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold text-purple-800 dark:text-purple-100">
                    Сообщение после предыдущего задания
                  </h2>
                  <button
                    type="button"
                    onClick={handlePostCompletionMessageToggle}
                    className="inline-flex items-center justify-center p-2 text-purple-700 transition border border-purple-200 rounded-full hover:text-purple-900 hover:border-purple-300 dark:border-purple-500/40 dark:text-purple-100 dark:hover:border-purple-300 dark:hover:text-purple-50"
                    aria-label={
                      isPostCompletionMessageCollapsed
                        ? 'Развернуть сообщение после задания'
                        : 'Свернуть сообщение после задания'
                    }
                    title={
                      isPostCompletionMessageCollapsed
                        ? 'Развернуть сообщение после задания'
                        : 'Свернуть сообщение после задания'
                    }
                  >
                    <svg
                      className="w-5 h-5"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d={
                          isPostCompletionMessageCollapsed
                            ? 'M6 9l6 6 6-6'
                            : 'M6 15l6-6 6 6'
                        }
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span className="sr-only">
                      {isPostCompletionMessageCollapsed
                        ? 'Развернуть сообщение после задания'
                        : 'Свернуть сообщение после задания'}
                    </span>
                  </button>
                </div>
                {!isPostCompletionMessageCollapsed ? (
                  <div className="mt-4">
                    <RichTaskContentView
                      html={postCompletionMessageHtml}
                      text=""
                      className="text-base leading-relaxed text-purple-900 break-words whitespace-pre-wrap dark:text-purple-100"
                      textClassName="text-base leading-relaxed text-purple-900 break-words whitespace-pre-wrap dark:text-purple-100"
                      directory={`games/process/post-message/${String(gameId || 'game')}/${String(teamId || 'team')}/${String(currentTaskState || 'state')}`}
                    />
                  </div>
                ) : null}
              </section>
            ) : null}

            {error ? (
              <section className="p-6 text-sm text-red-700 border border-red-200 bg-red-50 rounded-3xl dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-100">
                Произошла ошибка при загрузке данных. Попробуйте обновить
                страницу позже.
              </section>
            ) : null}

            {statusNotice ? (
              <section className="p-6 text-sm text-blue-800 border border-blue-200 bg-blue-50 rounded-3xl dark:bg-blue-500/10 dark:border-blue-500/30 dark:text-blue-100">
                {statusNotice}
              </section>
            ) : null}

            {shouldRenderPostCompletionMessage && !isGameCompletion ? (
              <section className="p-6 border border-purple-200 shadow-lg bg-purple-50 rounded-3xl dark:bg-purple-500/10 dark:border-purple-500/30 dark:shadow-slate-950/40">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold text-purple-800 dark:text-purple-100">
                    Сообщение после предыдущего задания
                  </h2>
                  <button
                    type="button"
                    onClick={handlePostCompletionMessageToggle}
                    className="inline-flex items-center justify-center p-2 text-purple-700 transition border border-purple-200 rounded-full hover:text-purple-900 hover:border-purple-300 dark:border-purple-500/40 dark:text-purple-100 dark:hover:border-purple-300 dark:hover:text-purple-50"
                    aria-label={
                      isPostCompletionMessageCollapsed
                        ? 'Развернуть сообщение после задания'
                        : 'Свернуть сообщение после задания'
                    }
                    title={
                      isPostCompletionMessageCollapsed
                        ? 'Развернуть сообщение после задания'
                        : 'Свернуть сообщение после задания'
                    }
                  >
                    <svg
                      className="w-5 h-5"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d={
                          isPostCompletionMessageCollapsed
                            ? 'M6 9l6 6 6-6'
                            : 'M6 15l6-6 6 6'
                        }
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span className="sr-only">
                      {isPostCompletionMessageCollapsed
                        ? 'Развернуть сообщение после задания'
                        : 'Свернуть сообщение после задания'}
                    </span>
                  </button>
                </div>
                {!isPostCompletionMessageCollapsed ? (
                  <div className="mt-4">
                    <RichTaskContentView
                      html={postCompletionMessageHtml}
                      text=""
                      className="text-base leading-relaxed text-purple-900 break-words whitespace-pre-wrap dark:text-purple-100"
                      textClassName="text-base leading-relaxed text-purple-900 break-words whitespace-pre-wrap dark:text-purple-100"
                      directory={`games/process/post-message/${String(gameId || 'game')}/${String(teamId || 'team')}/${String(currentTaskState || 'state')}`}
                    />
                  </div>
                ) : null}
              </section>
            ) : null}

            {shouldShowGameCompletedBlock ? (
              <section className="p-6 border shadow-lg border-emerald-200 bg-emerald-50 rounded-3xl dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:shadow-slate-950/40">
                <h2 className="text-lg font-semibold text-emerald-800 dark:text-emerald-100">
                  Игра окончена
                </h2>
                <p className="mt-4 text-base leading-relaxed text-emerald-900 dark:text-emerald-100">
                  Поздравляем! Вы завершили игру.
                </p>
                {game?.finishingPlace ? (
                  <p className="mt-3 text-base leading-relaxed text-emerald-900 dark:text-emerald-100">
                    Точка сбора после игры: {game.finishingPlace}
                  </p>
                ) : null}
              </section>
            ) : null}

            {shouldShowGameMessagesBlock ? (
              <section className="p-6 border shadow-lg border-amber-200 bg-amber-50 rounded-3xl dark:bg-amber-500/10 dark:border-amber-500/30 dark:shadow-slate-950/40">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-amber-900 dark:text-amber-100">
                      Сообщения организатора
                    </h2>
                    {displayedAdminMessage ? (
                      <p className="mt-1 text-xs text-amber-700 dark:text-amber-200/80">
                        {formatMessageDateTime(displayedAdminMessage.createdAt)}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsGameMessagesModalOpen(true)}
                      className="inline-flex items-center rounded-full border border-amber-300 bg-white px-3 py-1.5 text-sm font-semibold text-amber-800 transition hover:border-amber-400 hover:bg-amber-100 dark:border-amber-500/40 dark:bg-slate-900/60 dark:text-amber-100 dark:hover:bg-amber-500/15"
                    >
                      Открыть переписку
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setDismissedLatestAdminMessageId(
                          displayedAdminMessage?.id || '__empty__',
                        )
                      }
                      className="inline-flex items-center justify-center w-8 h-8 transition bg-white border rounded-full border-amber-300 text-amber-700 hover:border-amber-400 hover:bg-amber-100 hover:text-amber-900 dark:border-amber-500/40 dark:bg-slate-900/60 dark:text-amber-100 dark:hover:bg-amber-500/15"
                      aria-label="Закрыть сообщение организатора"
                      title="Закрыть"
                    >
                      <CloseIcon />
                    </button>
                  </div>
                </div>
                {displayedAdminMessage ? (
                  <p className="mt-4 text-base leading-relaxed break-words whitespace-pre-wrap text-amber-950 dark:text-amber-50">
                    <LinkedMessageText text={displayedAdminMessage.body} />
                  </p>
                ) : (
                  <p className="mt-4 text-sm text-amber-800 dark:text-amber-100">
                    Переписка с организатором доступна связному команды. Если
                    связной не назначен, писать может капитан.
                  </p>
                )}
              </section>
            ) : null}

            {isStoryGame && status === 'started' && !error ? (
              <StoryQuestProcess
                gameId={gameId}
                teamId={teamId}
                isActive={isStoryGame && status === 'started'}
              />
            ) : null}

            {shouldShowCurrentTaskBlock ? (
              <section className="p-6 bg-white shadow-lg rounded-3xl dark:bg-slate-900 dark:border dark:border-slate-800 dark:shadow-slate-950/40">
                <div className="flex items-center justify-between gap-3">
                  <h2
                    className={`font-semibold text-primary dark:text-white ${
                      isBreakState ? 'text-2xl uppercase' : 'text-lg'
                    }`}
                  >
                    {isBreakState ? 'ПЕРЕРЫВ' : `Задание ${currentTaskNumber}`}
                  </h2>
                  <button
                    type="button"
                    onClick={() => {
                      void handleTaskRefresh()
                    }}
                    disabled={isTaskRefreshing}
                    className="inline-flex items-center justify-center p-2 text-gray-600 transition border border-gray-300 rounded-full hover:text-blue-600 hover:border-blue-400 disabled:opacity-60 disabled:cursor-not-allowed dark:border-slate-700 dark:text-slate-200 dark:hover:border-blue-400 dark:hover:text-blue-300"
                    aria-label="Обновить текущее задание"
                    title="Обновить текущее задание"
                  >
                    <FontAwesomeIcon
                      icon={faArrowsRotate}
                      className={`w-5 h-5 ${
                        isTaskRefreshing ? 'animate-spin' : ''
                      }`}
                    />
                  </button>
                </div>
                <div ref={taskContentRef}>
                  <div
                    className="hidden"
                    aria-hidden="true"
                    dangerouslySetInnerHTML={{ __html: formattedTaskMessage }}
                  />
                </div>
                <TaskDisplayWithClues
                  taskHtml={resolvedTaskHtml}
                  taskText={resolvedTaskText}
                  clues={visibleTaskClues}
                  taskMeta={isBreakState ? null : currentTaskDisplayMeta}
                  directoryBase={`games/process/task/${String(gameId || 'game')}/${String(teamId || 'team')}/${String(currentTaskState || 'state')}`}
                  taskClassName="mt-4 text-base leading-relaxed text-gray-700 break-words whitespace-pre-wrap dark:text-slate-200"
                  taskTextClassName="mt-4 text-base leading-relaxed text-gray-700 break-words whitespace-pre-wrap dark:text-slate-200"
                  cluesWrapperClassName="mt-4 space-y-4"
                  clueCardClassName="rounded-2xl border border-cyan-300/70 bg-cyan-50/80 p-4 dark:border-cyan-500/40 dark:bg-cyan-500/10"
                  clueTitleClassName="text-sm font-semibold text-cyan-900 dark:text-cyan-100"
                  clueContentClassName="mt-2 text-base leading-relaxed text-gray-700 break-words whitespace-pre-wrap dark:text-slate-200"
                  clueContentTextClassName="mt-2 text-base leading-relaxed text-gray-700 break-words whitespace-pre-wrap dark:text-slate-200"
                  metaWrapperClassName="mt-4 space-y-1"
                  metaTextClassName="text-base font-semibold leading-relaxed text-gray-700 dark:text-slate-200"
                />
                {canCaptainFinishBreak ? (
                  <div className="flex flex-wrap items-center gap-3 px-4 py-3 mt-5 border rounded-2xl border-emerald-300 bg-emerald-50 dark:border-emerald-500/40 dark:bg-emerald-500/10">
                    <button
                      type="button"
                      onClick={handleFinishBreakRequest}
                      disabled={isFinishingBreak || isTaskRefreshing}
                      className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-emerald-500 dark:hover:bg-emerald-400"
                    >
                      {isFinishingBreak
                        ? 'Завершаем перерыв...'
                        : 'Завершить перерыв досрочно'}
                    </button>
                    <span className="text-sm font-medium text-emerald-800 dark:text-emerald-100">
                      Доступно капитану команды
                    </span>
                  </div>
                ) : null}
                {canCaptainForceClue ? (
                  <div className="flex flex-wrap items-center gap-3 px-4 py-3 mt-5 border rounded-2xl border-cyan-300 bg-cyan-50 dark:border-cyan-500/40 dark:bg-cyan-500/10">
                    <button
                      type="button"
                      onClick={handleForceClueRequest}
                      disabled={isForcingClue || isTaskRefreshing}
                      className="inline-flex items-center justify-center rounded-full bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-cyan-500 dark:hover:bg-cyan-400"
                    >
                      {isForcingClue
                        ? 'Получаем подсказку...'
                        : 'Получить подсказку досрочно'}
                    </button>
                    <span className="text-sm font-medium text-cyan-800 dark:text-cyan-100">
                      Доступно капитану команды
                    </span>
                  </div>
                ) : null}
                {canCaptainFailTask ? (
                  <div className="flex flex-wrap items-center gap-3 px-4 py-3 mt-5 border rounded-2xl border-rose-300 bg-rose-50 dark:border-rose-500/40 dark:bg-rose-500/10">
                    <button
                      type="button"
                      onClick={handleFailTaskRequest}
                      disabled={isFailingTask || isTaskRefreshing}
                      className="inline-flex items-center justify-center rounded-full bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-rose-500 dark:hover:bg-rose-400"
                    >
                      {isFailingTask ? 'Сливаем задание...' : 'Слить задание'}
                    </button>
                    <span className="text-sm font-medium text-rose-800 dark:text-rose-100">
                      Доступно капитану после всех подсказок
                    </span>
                  </div>
                ) : null}
                {!isBreakState && acceptedTaskCodes.length > 0 ? (
                  <div className="mt-4">
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-100">
                      Принятые основные коды:
                    </p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {acceptedTaskCodes.map((code, index) => (
                        <span
                          key={`accepted-code-${index}-${code}`}
                          className="inline-flex items-center px-3 py-1 text-xs font-semibold tracking-wide border rounded-full border-emerald-300/70 bg-emerald-50/90 text-emerald-800 dark:border-emerald-500/50 dark:bg-emerald-500/15 dark:text-emerald-100"
                        >
                          {code}
                        </span>
                      ))}
                    </div>
                    {remainingMainCodesCount !== null ? (
                      <p className="mt-2 text-sm font-semibold text-slate-700 dark:text-slate-100">
                        Осталось ввести кодов: {remainingMainCodesCount}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                {!isBreakState && acceptedBonusCodeItems.length > 0 ? (
                  <div className="mt-3">
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-100">
                      Принятые бонусные коды:
                    </p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {acceptedBonusCodeItems.map((item, index) => {
                        const timeLabel = formatCodeTimeSeconds(item.value)
                        return (
                          <span
                            key={`accepted-bonus-code-${index}-${item.code}`}
                            className="inline-flex items-center px-3 py-1 text-xs font-semibold tracking-wide border rounded-full border-cyan-300/70 bg-cyan-50/90 text-cyan-800 dark:border-cyan-500/50 dark:bg-cyan-500/15 dark:text-cyan-100"
                            title={item.description || undefined}
                          >
                            {item.code}
                            {item.description ? ` — ${item.description}` : ''}
                            {timeLabel ? ` (бонус ${timeLabel})` : ''}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                ) : null}
                {!isBreakState && acceptedPenaltyCodeItems.length > 0 ? (
                  <div className="mt-3">
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-100">
                      Принятые штрафные коды:
                    </p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {acceptedPenaltyCodeItems.map((item, index) => {
                        const timeLabel = formatCodeTimeSeconds(item.value)
                        return (
                          <span
                            key={`accepted-penalty-code-${index}-${item.code}`}
                            className="inline-flex items-center px-3 py-1 text-xs font-semibold tracking-wide border rounded-full border-rose-300/70 bg-rose-50/90 text-rose-800 dark:border-rose-500/50 dark:bg-rose-500/15 dark:text-rose-100"
                            title={item.description || undefined}
                          >
                            {item.code}
                            {item.description ? ` — ${item.description}` : ''}
                            {timeLabel ? ` (штраф ${timeLabel})` : ''}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                ) : null}
                <div
                  ref={countdownPanelRef}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl border border-cyan-300/70 bg-cyan-50/80 px-3 py-1.5 text-sm font-semibold text-cyan-800 dark:border-cyan-500/40 dark:bg-cyan-500/12 dark:text-cyan-100"
                  style={{ display: 'none' }}
                >
                  <span ref={countdownPanelLabelRef} />
                  <span
                    ref={countdownPanelValueRef}
                    className="font-mono tracking-wide"
                  />
                </div>
                {taskRefreshError ? (
                  <p className="mt-3 text-sm text-red-600 dark:text-red-300">
                    {taskRefreshError}
                  </p>
                ) : null}
              </section>
            ) : null}

            {shouldShowLastMessage ? (
              <section className="p-6 bg-white shadow-lg rounded-3xl dark:bg-slate-900 dark:border dark:border-slate-800 dark:shadow-slate-950/40">
                <h2 className="text-lg font-semibold text-primary dark:text-white">
                  Последние сообщения
                </h2>
                <div className="flex flex-col gap-4 mt-4">
                  {displayedResultMessages.map((html, index) => (
                    <div
                      key={`result-message-${index}`}
                      className="px-4 py-3 border rounded-2xl border-violet-300/60 bg-violet-50/75 dark:border-violet-500/35 dark:bg-violet-500/12"
                    >
                      <RichTaskContentView
                        html={html}
                        text=""
                        className="text-base leading-relaxed text-gray-700 break-words whitespace-pre-wrap dark:text-slate-200 [&_blockquote]:mt-2 [&_blockquote]:rounded-2xl [&_blockquote]:border [&_blockquote]:border-violet-300/70 [&_blockquote]:bg-violet-50/90 [&_blockquote]:px-3 [&_blockquote]:py-2 dark:[&_blockquote]:border-violet-500/35 dark:[&_blockquote]:bg-slate-800/70"
                        textClassName="text-base leading-relaxed text-gray-700 break-words whitespace-pre-wrap dark:text-slate-200"
                        directory={`games/process/messages/${String(gameId || 'game')}/${String(teamId || 'team')}/${index}`}
                      />
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {shouldShowAnswerForm ? (
              <section className="p-6 bg-white shadow-lg rounded-3xl dark:bg-slate-900 dark:border dark:border-slate-800 dark:shadow-slate-950/40">
                <h2 className="text-lg font-semibold text-primary dark:text-white">
                  {isPhotoGame ? 'Фото-ответ на задание' : 'Ответ на задание'}
                </h2>
                {isPhotoGame ? (
                  <div className="flex flex-col gap-4 mt-4">
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Можно отправить несколько фотографий на одно задание.
                      Статус проверки будет доступен только после публикации
                      результатов.
                    </p>
                    <label className="flex flex-col items-center justify-center px-4 py-8 text-center transition border-2 border-dashed cursor-pointer rounded-2xl border-cyan-300 bg-cyan-50 hover:border-cyan-500 hover:bg-cyan-100 dark:border-cyan-500/40 dark:bg-cyan-500/10 dark:hover:bg-cyan-500/15">
                      <input
                        type="file"
                        accept={PHOTO_ANSWER_ACCEPT_TYPES}
                        multiple
                        onChange={handlePhotoAnswerUpload}
                        disabled={isPhotoUploading}
                        className="sr-only"
                      />
                      <span className="text-base font-semibold text-cyan-900 dark:text-cyan-100">
                        {isPhotoUploading
                          ? 'Загружаем фото...'
                          : 'Выбрать фото'}
                      </span>
                      <span className="mt-1 text-sm text-cyan-700 dark:text-cyan-200/80">
                        JPG, PNG, WEBP или фото с камеры
                      </span>
                    </label>
                    {photoUploadError ? (
                      <p className="px-3 py-2 text-sm border rounded-xl border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
                        {photoUploadError}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <form
                    className="flex flex-col gap-4 mt-4"
                    onSubmit={handleSubmit}
                  >
                    <input
                      type="text"
                      value={answer}
                      maxLength={20}
                      onChange={(event) =>
                        setAnswer(event.target.value.slice(0, 20))
                      }
                      placeholder="Введите код или сообщение"
                      className="w-full px-4 py-3 text-base transition border border-gray-300 rounded-2xl focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-blue-400"
                    />
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="submit"
                        disabled={isSubmitting || !answer.trim()}
                        className="px-6 py-3 text-sm font-semibold text-white transition rounded-full bg-primary hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        Отправить
                      </button>
                    </div>
                  </form>
                )}
              </section>
            ) : null}

            {Array.isArray(currentResult?.images) &&
            currentResult.images.length > 0 ? (
              <section className="p-6 bg-white shadow-lg rounded-3xl dark:bg-slate-900 dark:border dark:border-slate-800 dark:shadow-slate-950/40">
                <h2 className="text-lg font-semibold text-primary dark:text-white">
                  Изображения задания
                </h2>
                <div className="grid gap-4 mt-4 sm:grid-cols-2">
                  {currentResult.images.map((src, index) => (
                    <img
                      key={`task-image-${index}`}
                      src={src}
                      alt={`Изображение задания ${index + 1}`}
                      className="object-cover w-full border border-gray-200 rounded-2xl dark:border-slate-700"
                    />
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        </main>
      </div>
      <Modal
        isOpen={isGameMessagesModalOpen}
        onClose={() => setIsGameMessagesModalOpen(false)}
        title="Переписка с организатором"
        compactMobile
        dialogClassName="md:h-[90vh]"
        bodyClassName="flex flex-col pb-0"
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsGameMessagesModalOpen(false)}
              className="aq-modal-btn aq-modal-btn-secondary"
            >
              Закрыть
            </button>
            {canSendGameMessage ? (
              <button
                type="button"
                onClick={handleSendGameMessage}
                disabled={isSendingGameMessage || !gameMessageDraft.trim()}
                className="aq-modal-btn aq-modal-btn-primary"
              >
                {isSendingGameMessage ? 'Отправляем...' : 'Отправить'}
              </button>
            ) : null}
          </>
        }
      >
        <div className="flex flex-col flex-1 min-h-0 gap-4">
          <GameMessageHistory
            messages={gameMessages}
            isLoading={gameMessagesLoading}
            error={gameMessagesError}
            listRef={gameMessagesListRef}
            viewer="team"
          />
          {canSendGameMessage ? (
            <div className="pt-4 border-t shrink-0 border-slate-200 dark:border-slate-700">
              <textarea
                ref={gameMessageTextareaRef}
                value={gameMessageDraft}
                onChange={handleGameMessageDraftChange}
                rows={1}
                maxLength={2000}
                className="w-full px-3 py-2 mt-2 overflow-hidden text-sm transition bg-white border outline-none resize-none rounded-xl border-slate-300 text-slate-900 focus:border-cyan-500 dark:border-slate-600/80 dark:bg-slate-900 dark:text-slate-100"
                placeholder="Напишите сообщение организатору..."
                disabled={isSendingGameMessage}
              />
            </div>
          ) : null}
        </div>
      </Modal>
      <Modal
        isOpen={isFinishBreakConfirmOpen}
        onClose={handleFinishBreakCancel}
        title="Завершить перерыв?"
        compactMobile
        footer={
          <>
            <button
              type="button"
              onClick={handleFinishBreakCancel}
              disabled={isFinishingBreak}
              className="aq-modal-btn aq-modal-btn-secondary"
            >
              Нет, продолжить перерыв
            </button>
            <button
              type="button"
              onClick={handleFinishBreakConfirm}
              disabled={isFinishingBreak || isTaskRefreshing}
              className="aq-modal-btn aq-modal-btn-primary"
            >
              {isFinishingBreak ? 'Завершаем...' : 'Да, завершить'}
            </button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          Вы уверены, что хотите завершить перерыв досрочно и получить следующее
          задание?
        </p>
      </Modal>
      <Modal
        isOpen={isForceClueConfirmOpen}
        onClose={handleForceClueCancel}
        title="Получить подсказку?"
        compactMobile
        footer={
          <>
            <button
              type="button"
              onClick={handleForceClueCancel}
              disabled={isForcingClue}
              className="aq-modal-btn aq-modal-btn-secondary"
            >
              Нет, продолжить задание
            </button>
            <button
              type="button"
              onClick={handleForceClueConfirm}
              disabled={isForcingClue || isTaskRefreshing}
              className="aq-modal-btn aq-modal-btn-primary"
            >
              {isForcingClue ? 'Получаем...' : 'Да, получить'}
            </button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          Вы уверены, что хотите получить подсказку досрочно? Команде будет
          добавлено игровое время:{' '}
          <span className="font-semibold text-slate-900 dark:text-slate-100">
            {formatCountdownSeconds(
              Number(currentCaptainActions?.forceClueAdvanceSeconds) || 0,
            )}
          </span>
          .
        </p>
      </Modal>
      <Modal
        isOpen={isFailTaskConfirmOpen}
        onClose={handleFailTaskCancel}
        title="Слить задание?"
        compactMobile
        footer={
          <>
            <button
              type="button"
              onClick={handleFailTaskCancel}
              disabled={isFailingTask}
              className="aq-modal-btn aq-modal-btn-secondary"
            >
              Нет, продолжить задание
            </button>
            <button
              type="button"
              onClick={handleFailTaskConfirm}
              disabled={isFailingTask || isTaskRefreshing}
              className="aq-modal-btn aq-modal-btn-primary"
            >
              {isFailingTask ? 'Сливаем...' : 'Да, слить'}
            </button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          Вы уверены, что хотите слить задание? Оно будет считаться
          невыполненным, а в статистике время на него будет засчитано как
          максимальное.
        </p>
      </Modal>
      <style jsx global>{`
        .aq-task-content a {
          color: #2563eb;
          text-decoration: underline;
          text-decoration-thickness: 2px;
          text-underline-offset: 3px;
          transition: color 0.2s ease-in-out;
        }

        .aq-task-content a:hover,
        .aq-task-content a:focus-visible {
          color: #1d4ed8;
        }

        .dark .aq-task-content a {
          color: #60a5fa;
        }

        .dark .aq-task-content a:hover,
        .dark .aq-task-content a:focus-visible {
          color: #bfdbfe;
        }

        .aq-task-content img {
          display: block;
          max-width: 100%;
          height: auto;
          margin: 12px 0;
          border-radius: 14px;
        }
      `}</style>
    </>
  )
}

GameTeamPage.propTypes = {
  location: PropTypes.string.isRequired,
  game: PropTypes.shape({
    name: PropTypes.string,
    dateStart: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.instanceOf(Date),
    ]),
    dateStartFact: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.instanceOf(Date),
    ]),
    dateEndFact: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.instanceOf(Date),
    ]),
    type: PropTypes.string,
  }),
  team: PropTypes.shape({
    name: PropTypes.string,
  }),
  status: PropTypes.string.isRequired,
  isGameStarted: PropTypes.bool.isRequired,
  isGameFinished: PropTypes.bool.isRequired,
  result: PropTypes.shape({
    message: PropTypes.string,
    images: PropTypes.arrayOf(PropTypes.string),
    followUpMessage: PropTypes.string,
    promptMessage: PropTypes.string,
    messages: PropTypes.arrayOf(PropTypes.string),
    shouldResetMessages: PropTypes.bool,
  }),
  taskHtml: PropTypes.string,
  taskDisplayHtml: PropTypes.string,
  taskDisplayText: PropTypes.string,
  taskDisplayTaskHtml: PropTypes.string,
  taskDisplayTaskText: PropTypes.string,
  taskDisplayClues: PropTypes.arrayOf(
    PropTypes.shape({
      index: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      label: PropTypes.string,
      html: PropTypes.string,
      text: PropTypes.string,
    }),
  ),
  taskDisplayMeta: PropTypes.shape({
    mainCodesCount: PropTypes.number,
    requiredCodesCount: PropTypes.number,
    bonusCodesCount: PropTypes.number,
    penaltyCodesCount: PropTypes.number,
  }),
  taskState: PropTypes.oneOf(['idle', 'active', 'break', 'completed']),
  captainActions: PropTypes.shape({
    canFinishBreak: PropTypes.bool,
    canForceClue: PropTypes.bool,
    forceClueAdvanceSeconds: PropTypes.number,
    nextClueNumber: PropTypes.number,
    canFailTask: PropTypes.bool,
  }),
  postCompletionMessage: PropTypes.string,
  error: PropTypes.string,
  session: PropTypes.shape({}),
  gameId: PropTypes.string.isRequired,
  teamId: PropTypes.string.isRequired,
  shouldClearMessageParam: PropTypes.bool,
}

GameTeamPage.defaultProps = {
  game: null,
  team: null,
  result: null,
  taskHtml: '',
  taskDisplayHtml: '',
  taskDisplayText: '',
  taskDisplayTaskHtml: '',
  taskDisplayTaskText: '',
  taskDisplayClues: [],
  taskDisplayMeta: null,
  taskState: 'idle',
  captainActions: null,
  postCompletionMessage: '',
  error: null,
  session: null,
  shouldClearMessageParam: false,
}

export default GameTeamPage
