import PropTypes from 'prop-types'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowsRotate } from '@fortawesome/free-solid-svg-icons'
import { useSession } from 'next-auth/react'
import { getServerSession } from 'next-auth/next'

import getTeamGameTaskState, {
  GAME_TASK_ERRORS,
} from '@server/getTeamGameTaskState'
import { LOCATIONS } from '@server/serverConstants'

import { authOptions } from '@pages/api/auth/[...nextauth]'

const statusLabels = {
  active: 'Ещё не началась',
  started: 'В процессе',
  finished: 'Завершена',
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

  return parts
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
      if (
        isGameCompletion &&
        (/(^|\s)введите\s+код/i.test(normalized) ||
          /код\s+не\s+верен/i.test(normalized))
      ) {
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

const formatCityName = (locationKey) => {
  if (!locationKey) return ''

  const town = LOCATIONS?.[locationKey]?.townRu
  if (!town) return locationKey

  const trimmed = town.trim()
  if (!trimmed) return locationKey

  return trimmed[0].toUpperCase() + trimmed.slice(1)
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
  taskState,
  postCompletionMessage,
  error,
  session: initialSession,
  gameId,
  teamId,
  shouldClearMessageParam,
}) {
  const { data: session } = useSession()
  const router = useRouter()

  const [theme, setTheme] = useState('light')
  const [isClient, setIsClient] = useState(false)
  const [answer, setAnswer] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isGameInfoCollapsed, setIsGameInfoCollapsed] = useState(false)
  const taskContentRef = useRef(null)
  const countdownElementsRef = useRef([])
  const refreshRequestedRef = useRef(0)
  const hasClearedMessageRef = useRef(false)
  const initialShouldClearMessages = Boolean(result?.shouldResetMessages)

  const [currentTaskHtml, setCurrentTaskHtml] = useState(taskHtml)
  const [currentTaskState, setCurrentTaskState] = useState(taskState)
  const [currentResult, setCurrentResult] = useState(result)
  const [currentPostCompletionMessage, setCurrentPostCompletionMessage] = useState(
    postCompletionMessage || ''
  )
  const [isTaskRefreshing, setIsTaskRefreshing] = useState(false)
  const [taskRefreshError, setTaskRefreshError] = useState(null)
  const [shouldClearMessagesForActiveTask, setShouldClearMessagesForActiveTask] =
    useState(initialShouldClearMessages)
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

  const collapseStorageKey = useMemo(
    () => `aq-game-info-collapsed-${gameId}-${teamId}`,
    [gameId, teamId]
  )

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    if (!isClient) return

    const storedTheme = window.localStorage.getItem('aq-theme')
    if (storedTheme === 'light' || storedTheme === 'dark') {
      setTheme(storedTheme)
      return
    }

    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches
    setTheme(prefersDark ? 'dark' : 'light')
  }, [isClient])

  useEffect(() => {
    if (!isClient) return

    window.document.documentElement.classList.toggle('dark', theme === 'dark')
    window.document.documentElement.setAttribute('data-theme', theme)
    window.localStorage.setItem('aq-theme', theme)
  }, [theme, isClient])

  useEffect(() => {
    if (!router.isReady) return
    setAnswer('')
  }, [router.asPath, router.isReady])

  useEffect(() => {
    refreshRequestedRef.current = 0
  }, [currentTaskHtml])

  useEffect(() => {
    setCurrentTaskHtml(taskHtml)
    setCurrentTaskState(taskState)
    setCurrentResult(result)
    setCurrentPostCompletionMessage(postCompletionMessage || '')
    setShouldClearMessagesForActiveTask(Boolean(result?.shouldResetMessages))
  }, [result, taskHtml, taskState, postCompletionMessage])

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
    if (!router.isReady) return
    if (!shouldClearMessageParam) return
    if (hasClearedMessageRef.current) return

    const cleanPath = `/${location}/game/${gameId}/${teamId}`
    hasClearedMessageRef.current = true
    router.replace(cleanPath, undefined, { shallow: true, scroll: false }).catch(
      () => null
    )
  }, [
    gameId,
    isClient,
    location,
    router.isReady,
    router,
    shouldClearMessageParam,
    teamId,
  ])

  useEffect(() => {
    if (!isClient) return

    const storedValue = window.localStorage.getItem(collapseStorageKey)
    setIsGameInfoCollapsed(storedValue === 'true')
  }, [collapseStorageKey, isClient])

  const handleThemeToggle = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
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

  const handleTaskRefresh = useCallback(
    async ({ recordTimestamp = true } = {}) => {
      if (isTaskRefreshing) return null

      if (recordTimestamp) {
        refreshRequestedRef.current = Date.now()
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
        setCurrentTaskHtml(payload.taskHtml || '')
        setCurrentTaskState(payload.taskState || 'idle')
        setCurrentResult(payload.result || null)
        setCurrentPostCompletionMessage(payload.postCompletionMessage || '')
        return true
      } catch (refreshError) {
        setTaskRefreshError(
          refreshError?.message || 'Не удалось обновить задание'
        )
        if (recordTimestamp) {
          refreshRequestedRef.current = 0
        }
        return false
      } finally {
        setIsTaskRefreshing(false)
      }
    },
    [gameId, isTaskRefreshing, location, teamId]
  )

  const handleLeaveGame = useCallback(() => {
    router.push(`/${location}/game/${gameId}`)
  }, [gameId, location, router])

  const handleSubmit = async (event) => {
    event.preventDefault()
    const trimmedAnswer = answer.trim().slice(0, 20)
    if (!trimmedAnswer) return

    setIsSubmitting(true)
    try {
      hasClearedMessageRef.current = false
      await router.push({
        pathname: `/${location}/game/${gameId}/${teamId}`,
        query: { message: trimmedAnswer },
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const statusLabel = statusLabels[status] ?? 'Статус неизвестен'
  const locationTimeZone = useMemo(
    () => LOCATIONS?.[location]?.timeZone || null,
    [location]
  )
  const plannedStart = useMemo(
    () => formatDateTime(game?.dateStart, locationTimeZone),
    [game?.dateStart, locationTimeZone]
  )
  const actualStart = useMemo(
    () => formatDateTime(game?.dateStartFact, locationTimeZone),
    [game?.dateStartFact, locationTimeZone]
  )
  const actualFinish = useMemo(
    () =>
      isGameFinished
        ? formatDateTime(game?.dateEndFact, locationTimeZone)
        : null,
    [game?.dateEndFact, isGameFinished, locationTimeZone]
  )
  const cityName = useMemo(() => formatCityName(location), [location])

  const formattedTaskMessage = useMemo(
    () => transformHtml(currentTaskHtml ?? ''),
    [currentTaskHtml]
  )
  const normalizedTaskMessage = useMemo(
    () => normalizeForComparison(currentTaskHtml),
    [currentTaskHtml]
  )

  const isBreakState = currentTaskState === 'break'
  const isCompletedState = currentTaskState === 'completed'
  const isGameCompletion = isGameFinished || isCompletedState
  const shouldClearMessagesForNewTask = currentTaskState === 'active'

  const currentResultMessagesRaw = useMemo(
    () =>
      collectResultMessages({
        result: currentResult,
        normalizedTaskMessage,
        isBreakState,
        isGameCompletion,
      })
    },
    [
      currentResult,
      normalizedTaskMessage,
      isBreakState,
      isGameCompletion,
      shouldClearMessagesForNewTask,
    ]
  )

  const currentResultMessages = useMemo(
    () => (shouldClearMessagesForNewTask ? [] : currentResultMessagesRaw),
    [shouldClearMessagesForNewTask, currentResultMessagesRaw]
  )

  const currentResultMessages = useMemo(
    () => (shouldClearMessagesForActiveTask ? [] : currentResultMessagesRaw),
    [shouldClearMessagesForActiveTask, currentResultMessagesRaw]
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
      currentResultMessagesRaw.length > 0
    ) {
      setShouldClearMessagesForActiveTask(false)
    }
  }, [
    currentResult,
    currentTaskState,
    currentResultMessagesRaw,
    shouldClearMessagesForActiveTask,
  ])

  useEffect(() => {
    if (shouldClearMessagesForActiveTask) {
      setLastResultSnapshot(null)
      return
    }

    if (currentResultMessages.length > 0 && currentResult) {
      setLastResultSnapshot(currentResult)
    } else if (currentResult && currentResultMessages.length === 0) {
      setLastResultSnapshot(null)
    }
  }, [currentResult, currentResultMessages, shouldClearMessagesForActiveTask])

  const fallbackResultMessages = useMemo(
    () => {
      if (currentResult || shouldClearMessagesForActiveTask) {
        return []
      }

      return collectResultMessages({
        result: lastResultSnapshot,
        normalizedTaskMessage,
        isBreakState,
        isGameCompletion,
      })
    },
    [
      currentResult,
      lastResultSnapshot,
      normalizedTaskMessage,
      isBreakState,
      isGameCompletion,
      shouldClearMessagesForActiveTask,
    ]
  )

  const resultMessages =
    currentResultMessages.length > 0
      ? currentResultMessages
      : fallbackResultMessages

  const postCompletionMessageHtml = useMemo(() => {
    if (!currentPostCompletionMessage) return ''

    const normalized = normalizeForComparison(currentPostCompletionMessage)
    if (!normalized) return ''

    return transformHtml(currentPostCompletionMessage)
  }, [currentPostCompletionMessage])

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

    if (postCompletionMessageHtml) {
      if (!unique.has(postCompletionMessageHtml)) {
        unique.add(postCompletionMessageHtml)
        output.push(postCompletionMessageHtml)
      }
    }

    return output
  }, [resultMessages, shouldClearMessagesForActiveTask, postCompletionMessageHtml])

  const shouldShowLastMessage = displayedResultMessages.length > 0
  const shouldShowAnswerForm = !isGameCompletion && !isBreakState
  const statusNotice = useMemo(() => {
    if (error) return null
    if (!isGameStarted && status === 'active') {
      return 'Игра ещё не началась. Ожидайте старта организатора.'
    }
    if (isGameFinished && currentTaskState !== 'completed') {
      return 'Игра завершена. Проверьте результаты в кабинете.'
    }
    return null
  }, [
    currentTaskState,
    error,
    isGameFinished,
    isGameStarted,
    status,
  ])

  useEffect(() => {
    if (!isClient) return

    const container = taskContentRef.current
    if (!container) {
      countdownElementsRef.current = []
      return
    }

    const elements = Array.from(
      container.querySelectorAll('[data-task-countdown]')
    ).map((element) => {
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

    countdownElementsRef.current = elements
  }, [formattedTaskMessage, isClient])

  useEffect(() => {
    if (!isClient) return
    if (countdownElementsRef.current.length === 0) return

    const updateCountdowns = () => {
      const now = Date.now()

      countdownElementsRef.current = countdownElementsRef.current.map((item) => {
        const { element, target, initialSeconds, startTimestamp } = item
        let remainingMs = null

        if (Number.isFinite(target)) {
          remainingMs = target - now
        } else if (Number.isFinite(initialSeconds)) {
          const base = Number.isFinite(startTimestamp) ? startTimestamp : now
          remainingMs = initialSeconds * 1000 - (now - base)
        }

        const remainingSeconds = Math.max(
          Math.ceil((remainingMs ?? 0) / 1000),
          0
        )

        element.textContent = formatCountdownSeconds(remainingSeconds)

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
                void router
                  .replace(router.asPath, undefined, { scroll: false })
                  .catch(() => null)
              }
            }

            void triggerRefresh()
          }
        }

        return {
          ...item,
          startTimestamp: Number.isFinite(startTimestamp) ? startTimestamp : now,
        }
      })
    }

    updateCountdowns()
    const intervalId = window.setInterval(updateCountdowns, 1000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [formattedTaskMessage, handleTaskRefresh, isClient, router])

  return (
    <>
      <Head>
        <title>{`ActQuest — Игра «${game?.name || 'Без названия'}»`}</title>
      </Head>
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
                onClick={handleThemeToggle}
                className="px-4 py-2 text-sm font-semibold text-gray-600 transition border border-gray-300 rounded-full hover:border-blue-400 hover:text-blue-600 dark:border-slate-700 dark:text-slate-200 dark:hover:border-blue-400 dark:hover:text-blue-300"
              >
                {theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
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
                          <span className="text-xs uppercase text-gray-400 dark:text-slate-500">
                            ГОРОД
                          </span>
                          <span className="font-medium text-gray-800 dark:text-slate-100">
                            {cityName || location}
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs uppercase text-gray-400 dark:text-slate-500">
                            Команда
                          </span>
                          <span className="font-medium text-gray-800 dark:text-slate-100">
                            {team?.name || 'Команда без названия'}
                          </span>
                        </div>
                        {plannedStart ? (
                          <div className="flex flex-col">
                            <span className="text-xs uppercase text-gray-400 dark:text-slate-500">
                              Планируемый старт
                            </span>
                            <span className="font-medium text-gray-800 dark:text-slate-100">
                              {plannedStart}
                            </span>
                          </div>
                        ) : null}
                        {actualStart ? (
                          <div className="flex flex-col">
                            <span className="text-xs uppercase text-gray-400 dark:text-slate-500">
                              Фактический старт
                            </span>
                            <span className="font-medium text-gray-800 dark:text-slate-100">
                              {actualStart}
                            </span>
                          </div>
                        ) : null}
                        {actualFinish ? (
                          <div className="flex flex-col">
                            <span className="text-xs uppercase text-gray-400 dark:text-slate-500">
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
                    className="self-start flex items-center justify-center p-2 text-gray-600 transition border border-gray-300 rounded-full hover:border-blue-400 hover:text-blue-600 dark:border-slate-700 dark:text-slate-200 dark:hover:border-blue-400 dark:hover:text-blue-300"
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
                        d={isGameInfoCollapsed ? 'M6 9l6 6 6-6' : 'M6 15l6-6 6 6'}
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

            {error ? (
              <section className="p-6 text-sm text-red-700 bg-red-50 border border-red-200 rounded-3xl dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-100">
                Произошла ошибка при загрузке данных. Попробуйте обновить страницу позже.
              </section>
            ) : null}

            {statusNotice ? (
              <section className="p-6 text-sm text-blue-800 bg-blue-50 border border-blue-200 rounded-3xl dark:bg-blue-500/10 dark:border-blue-500/30 dark:text-blue-100">
                {statusNotice}
              </section>
            ) : null}

            {formattedTaskMessage ? (
              <section className="p-6 bg-white shadow-lg rounded-3xl dark:bg-slate-900 dark:border dark:border-slate-800 dark:shadow-slate-950/40">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold text-primary dark:text-white">
                    Текущее задание
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
                      className={`w-5 h-5 ${isTaskRefreshing ? 'animate-spin' : ''}`}
                    />
                  </button>
                </div>
                {taskRefreshError ? (
                  <p className="mt-3 text-sm text-red-600 dark:text-red-300">
                    {taskRefreshError}
                  </p>
                ) : null}
                <div
                  className="mt-4 text-base leading-relaxed text-gray-700 whitespace-pre-wrap break-words dark:text-slate-200 aq-task-content"
                  ref={taskContentRef}
                  dangerouslySetInnerHTML={{ __html: formattedTaskMessage }}
                />
              </section>
            ) : null}

            {shouldShowLastMessage ? (
              <section className="p-6 bg-white shadow-lg rounded-3xl dark:bg-slate-900 dark:border dark:border-slate-800 dark:shadow-slate-950/40">
                <h2 className="text-lg font-semibold text-primary dark:text-white">Последние сообщения</h2>
                <div className="flex flex-col mt-4 gap-4">
                  {displayedResultMessages.map((html, index) => (
                    <div
                      key={`result-message-${index}`}
                      className="text-base leading-relaxed text-gray-700 whitespace-pre-wrap break-words dark:text-slate-200 aq-task-content"
                      dangerouslySetInnerHTML={{ __html: html }}
                    />
                  ))}
                </div>
              </section>
            ) : null}

            {shouldShowAnswerForm ? (
              <section className="p-6 bg-white shadow-lg rounded-3xl dark:bg-slate-900 dark:border dark:border-slate-800 dark:shadow-slate-950/40">
                <h2 className="text-lg font-semibold text-primary dark:text-white">Ответ на задание</h2>
                <form className="flex flex-col gap-4 mt-4" onSubmit={handleSubmit}>
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
              </section>
            ) : null}

            {Array.isArray(currentResult?.images) && currentResult.images.length > 0 ? (
              <section className="p-6 bg-white shadow-lg rounded-3xl dark:bg-slate-900 dark:border dark:border-slate-800 dark:shadow-slate-950/40">
                <h2 className="text-lg font-semibold text-primary dark:text-white">Изображения задания</h2>
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
      `}</style>
    </>
  )
}

GameTeamPage.propTypes = {
  location: PropTypes.string.isRequired,
  game: PropTypes.shape({
    name: PropTypes.string,
    dateStart: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
    dateStartFact: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
    dateEndFact: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
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
  taskState: PropTypes.oneOf(['idle', 'active', 'break', 'completed']),
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
  taskState: 'idle',
  postCompletionMessage: '',
  error: null,
  session: null,
  shouldClearMessageParam: false,
}

export default GameTeamPage

export const getServerSideProps = async (context) => {
  const { params, req, res, resolvedUrl, query } = context
  const locationParam = params?.location
  const gameIdParam = params?.id
  const teamIdParam = params?.teamId

  if (
    typeof locationParam !== 'string' ||
    typeof gameIdParam !== 'string' ||
    typeof teamIdParam !== 'string'
  ) {
    return { notFound: true }
  }

  const session = await getServerSession(req, res, authOptions)

  if (!session) {
    const callbackUrl = resolvedUrl?.startsWith('/')
      ? resolvedUrl
      : `/${resolvedUrl ?? ''}`

    return {
      redirect: {
        destination: `/api/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`,
        permanent: false,
      },
    }
  }

  const messageParam = typeof query.message === 'string' ? query.message : undefined
  const sanitizedMessage =
    messageParam && messageParam !== 'undefined' ? messageParam.trim() : undefined
  const shouldClearMessageParam = Boolean(sanitizedMessage)

  try {
    const stateResult = await getTeamGameTaskState({
      location: locationParam,
      gameId: gameIdParam,
      teamId: teamIdParam,
      telegramId: session?.user?.telegramId,
      message: sanitizedMessage,
    })

    if (!stateResult.success) {
      const { errorCode } = stateResult

      if (
        errorCode === GAME_TASK_ERRORS.GAME_NOT_FOUND ||
        errorCode === GAME_TASK_ERRORS.TEAM_NOT_FOUND
      ) {
        return { notFound: true }
      }

      if (errorCode === GAME_TASK_ERRORS.TEAM_ACCESS_DENIED) {
        return {
          redirect: {
            destination: `/${locationParam}/game/${gameIdParam}`,
            permanent: false,
          },
        }
      }

      if (errorCode === GAME_TASK_ERRORS.DB_CONNECTION_FAILED) {
        const fallbackGame = stateResult.game || null
        const fallbackTeam = stateResult.team || null
        const fallbackStatus = stateResult.status || fallbackGame?.status || 'active'
        const isGameStarted =
          stateResult.isGameStarted ?? fallbackStatus === 'started'
        const isGameFinished =
          stateResult.isGameFinished ?? fallbackStatus === 'finished'

        return {
          props: {
            session,
            location: locationParam,
            game: fallbackGame,
            team: fallbackTeam,
            status: fallbackStatus,
            isGameStarted,
            isGameFinished,
            result: null,
            taskHtml: '',
            taskState: 'idle',
            postCompletionMessage: '',
            error: 'DB_CONNECTION_FAILED',
            gameId: gameIdParam,
            teamId: teamIdParam,
            shouldClearMessageParam,
          },
        }
      }

      return {
        props: {
          session,
          location: locationParam,
          game: stateResult.game || null,
          team: stateResult.team || null,
          status: stateResult.status || 'active',
          isGameStarted: stateResult.isGameStarted ?? false,
          isGameFinished: stateResult.isGameFinished ?? false,
          result: null,
          taskHtml: '',
          taskState: 'idle',
          postCompletionMessage: '',
          error: 'UNKNOWN_ERROR',
          gameId: gameIdParam,
          teamId: teamIdParam,
          shouldClearMessageParam,
        },
      }
    }

    const data = stateResult.data

    return {
      props: {
        session,
        location: locationParam,
        game: data.game,
        team: data.team,
        status: data.status,
        isGameStarted: data.isGameStarted,
        isGameFinished: data.isGameFinished,
        result: data.result,
        taskHtml: data.taskHtml,
        taskState: data.taskState,
        postCompletionMessage: data.postCompletionMessage || '',
        error: null,
        gameId: gameIdParam,
        teamId: teamIdParam,
        shouldClearMessageParam,
      },
    }
  } catch (err) {
    console.error('Game team page error', err)
    return {
      props: {
        session,
        location: locationParam,
        game: null,
        team: null,
        status: 'active',
        isGameStarted: false,
        isGameFinished: false,
      result: null,
      taskHtml: '',
      taskState: 'idle',
      postCompletionMessage: '',
      error: 'UNKNOWN_ERROR',
      gameId: gameIdParam,
      teamId: teamIdParam,
      shouldClearMessageParam,
    },
    }
  }
}
