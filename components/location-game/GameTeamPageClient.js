'use client'

import PropTypes from 'prop-types'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowsRotate } from '@fortawesome/free-solid-svg-icons'
import { useSession } from 'next-auth/react'

import { LOCATIONS } from '@server/serverConstants'
import normalizeAudioMessageHtml from '@helpers/normalizeAudioMessageHtml'
import RichTaskContentView from '@components/game/RichTaskContentView'
import TaskDisplayWithClues from '@components/game/TaskDisplayWithClues'

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
      if (
        isGameCompletion &&
        /код\s+не\s+верен/i.test(normalized)
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

const normalizeTaskPayload = ({
  taskHtml = '',
  taskDisplayHtml = '',
  taskDisplayText = '',
  taskDisplayTaskHtml = '',
  taskDisplayTaskText = '',
  taskDisplayClues = [],
  taskDisplayMeta = null,
  taskState = 'idle',
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
  const [isGameInfoCollapsed, setIsGameInfoCollapsed] = useState(false)
  const [
    isPostCompletionMessageCollapsed,
    setIsPostCompletionMessageCollapsed,
  ] = useState(false)
  const taskContentRef = useRef(null)
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

  const handleLeaveGame = useCallback(() => {
    router.push(`/game/${gameId}`)
  }, [gameId, location, router])

  const handleSubmit = async (event) => {
    event.preventDefault()
    const trimmedAnswer = answer.trim().slice(0, 20)
    if (!trimmedAnswer) return

    const scrollYBeforeSubmit =
      typeof window !== 'undefined' ? window.scrollY || 0 : 0
    if (typeof document !== 'undefined') {
      const activeElement = document.activeElement
      if (activeElement instanceof HTMLElement) {
        activeElement.blur()
      }
    }

    const restoreScrollPosition = () => {
      if (typeof window === 'undefined') return
      window.requestAnimationFrame(() => {
        window.scrollTo({
          top: scrollYBeforeSubmit,
          left: 0,
          behavior: 'auto',
        })
      })
      window.setTimeout(() => {
        window.scrollTo({
          top: scrollYBeforeSubmit,
          left: 0,
          behavior: 'auto',
        })
      }, 120)
    }

    setIsSubmitting(true)
    setStickyMessages([])
    try {
      hasClearedMessageRef.current = false
      await router.push(
        `/game/${gameId}/process/${teamId}?message=${encodeURIComponent(trimmedAnswer)}`,
        { scroll: false },
      )
      restoreScrollPosition()
    } finally {
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
    return typeValue === 'photo' ? 'Фотоквест' : 'Автоквест'
  }, [game?.type])

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
    () => Array.isArray(currentTaskDisplayClues) ? currentTaskDisplayClues : [],
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
        if (!code) return null
        return { code, description }
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
        if (!code) return null
        return { code, description }
      })
      .filter(Boolean)
  }, [currentTaskDisplayMeta])
  const remainingMainCodesCount = useMemo(() => {
    if (acceptedTaskCodes.length < 1) {
      return null
    }

    const mainCodesCountRaw = Number(currentTaskDisplayMeta?.mainCodesCount)
    const mainCodesCount = Number.isFinite(mainCodesCountRaw)
      ? Math.max(0, Math.floor(mainCodesCountRaw))
      : 0

    const requiredCodesRaw = Number(currentTaskDisplayMeta?.requiredCodesCount)
    const requiredCodesCount = Number.isFinite(requiredCodesRaw)
      ? Math.max(0, Math.floor(requiredCodesRaw))
      : mainCodesCount

    const cappedRequiredCodes =
      mainCodesCount > 0
        ? Math.min(requiredCodesCount, mainCodesCount)
        : requiredCodesCount

    const remaining = Math.max(cappedRequiredCodes - acceptedTaskCodes.length, 0)
    return remaining > 0 ? remaining : null
  }, [
    acceptedTaskCodes.length,
    currentTaskDisplayMeta?.mainCodesCount,
    currentTaskDisplayMeta?.requiredCodesCount,
  ])

  const isBreakState = currentTaskState === 'break'
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

    const normalized = normalizeForComparison(currentPostCompletionMessage)
    if (!normalized) return ''

    return transformHtml(currentPostCompletionMessage)
  }, [currentPostCompletionMessage])

  const shouldRenderPostCompletionMessage = Boolean(postCompletionMessageHtml)

  useEffect(() => {
    if (!shouldRenderPostCompletionMessage) {
      previousPostCompletionMessageRef.current = ''
      setIsPostCompletionMessageCollapsed(false)
      return
    }

    const normalizedMessage = postCompletionMessageHtml || ''
    if (
      normalizedMessage &&
      previousPostCompletionMessageRef.current !== normalizedMessage
    ) {
      setIsPostCompletionMessageCollapsed(false)
    }

    previousPostCompletionMessageRef.current = normalizedMessage
  }, [postCompletionMessageHtml, shouldRenderPostCompletionMessage])

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

  const shouldShowLastMessage = displayedResultMessages.length > 0
  const shouldShowAnswerForm = !isGameCompletion && !isBreakState
  const shouldShowGameCompletedBlock = isGameCompletion
  const shouldShowCurrentTaskBlock =
    Boolean(resolvedTaskHtml || resolvedTaskText || visibleTaskClues.length > 0) &&
    !shouldShowGameCompletedBlock
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
                onClick={handleThemeToggle}
                className="px-4 py-2 text-sm font-semibold text-gray-600 transition border border-gray-300 rounded-full hover:border-blue-400 hover:text-blue-600 dark:border-slate-700 dark:text-slate-200 dark:hover:border-blue-400 dark:hover:text-blue-300"
              >
                {effectiveTheme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
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
                          isGameInfoCollapsed ? 'M6 9l6 6 6-6' : 'M6 15l6-6 6 6'
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

            {shouldRenderPostCompletionMessage ? (
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
              <section className="p-6 border border-emerald-200 shadow-lg bg-emerald-50 rounded-3xl dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:shadow-slate-950/40">
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

            {shouldShowCurrentTaskBlock ? (
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
                {!isBreakState && acceptedTaskCodes.length > 0 ? (
                  <div className="mt-4">
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-100">
                      Принятые основные коды:
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {acceptedTaskCodes.map((code, index) => (
                        <span
                          key={`accepted-code-${index}-${code}`}
                          className="inline-flex items-center rounded-full border border-emerald-300/70 bg-emerald-50/90 px-3 py-1 text-xs font-semibold tracking-wide text-emerald-800 dark:border-emerald-500/50 dark:bg-emerald-500/15 dark:text-emerald-100"
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
                    <div className="mt-2 flex flex-wrap gap-2">
                      {acceptedBonusCodeItems.map((item, index) => (
                        <span
                          key={`accepted-bonus-code-${index}-${item.code}`}
                          className="inline-flex items-center rounded-full border border-cyan-300/70 bg-cyan-50/90 px-3 py-1 text-xs font-semibold tracking-wide text-cyan-800 dark:border-cyan-500/50 dark:bg-cyan-500/15 dark:text-cyan-100"
                          title={item.description || undefined}
                        >
                          {item.code}
                          {item.description ? ` — ${item.description}` : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
                {!isBreakState && acceptedPenaltyCodeItems.length > 0 ? (
                  <div className="mt-3">
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-100">
                      Принятые штрафные коды:
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {acceptedPenaltyCodeItems.map((item, index) => (
                        <span
                          key={`accepted-penalty-code-${index}-${item.code}`}
                          className="inline-flex items-center rounded-full border border-rose-300/70 bg-rose-50/90 px-3 py-1 text-xs font-semibold tracking-wide text-rose-800 dark:border-rose-500/50 dark:bg-rose-500/15 dark:text-rose-100"
                          title={item.description || undefined}
                        >
                          {item.code}
                          {item.description ? ` — ${item.description}` : ''}
                        </span>
                      ))}
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
                      className="rounded-2xl border border-violet-300/60 bg-violet-50/75 px-4 py-3 dark:border-violet-500/35 dark:bg-violet-500/12"
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
                  Ответ на задание
                </h2>
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
  postCompletionMessage: '',
  error: null,
  session: null,
  shouldClearMessageParam: false,
}

export default GameTeamPage
