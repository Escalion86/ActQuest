import PropTypes from 'prop-types'
import { useEffect, useMemo, useRef, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { getSession, signOut, useSession } from 'next-auth/react'

import fetchGame from '@server/fetchGame'
import fetchTeam from '@server/fetchTeam'
import webGameProcess from '@server/webGameProcess'
import dbConnect from '@utils/dbConnect'
import taskText from 'telegram/func/taskText'

const ensureDateValue = (value) => {
  if (!value) return null

  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const cloneDateValue = (value) => {
  const date = ensureDateValue(value)
  return date ? new Date(date.getTime()) : null
}

const ensureArrayWithLength = (value, length, filler) => {
  const base = Array.isArray(value) ? [...value] : []
  if (base.length < length) {
    return base.concat(new Array(length - base.length).fill(filler))
  }
  return base.slice(0, length)
}

const parseDurationSeconds = (value, fallback) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return Math.max(Math.floor(numeric), 0)
}

const statusLabels = {
  active: 'Ещё не началась',
  started: 'В процессе',
  finished: 'Завершена',
}

const formatDateTime = (value) => {
  if (!value) return null

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null

  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
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

const formatCountdownSeconds = (totalSeconds) => {
  if (!Number.isFinite(totalSeconds)) return '00:00:00'

  const safeSeconds = Math.max(totalSeconds, 0)
  const hours = Math.floor(safeSeconds / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)
  const seconds = safeSeconds % 60
  const pad = (num) => String(num).padStart(2, '0')

  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
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
  error,
  session: initialSession,
  gameId,
  teamId,
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
  const refreshRequestedRef = useRef(false)

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
    refreshRequestedRef.current = false
  }, [taskHtml])

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

  const handleSignOut = async () => {
    await signOut({ redirect: false })
    router.push('/')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!answer.trim()) return

    setIsSubmitting(true)
    try {
      await router.push({
        pathname: `/${location}/game/${gameId}/${teamId}`,
        query: { message: answer.trim() },
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const statusLabel = statusLabels[status] ?? 'Статус неизвестен'
  const plannedStart = useMemo(() => formatDateTime(game?.dateStart), [game?.dateStart])
  const actualStart = useMemo(() => formatDateTime(game?.dateStartFact), [game?.dateStartFact])
  const actualFinish = useMemo(() => formatDateTime(game?.dateEndFact), [game?.dateEndFact])

  const formattedTaskMessage = useMemo(() => transformHtml(taskHtml ?? ''), [taskHtml])
  const normalizedTaskMessage = useMemo(
    () => normalizeForComparison(taskHtml),
    [taskHtml]
  )

  const isBreakState = taskState === 'break'

  const resultMessages = useMemo(() => {
    if (!result) return []

    const rawMessages = Array.isArray(result.messages) && result.messages.length > 0
      ? result.messages
      : [result.message].filter(Boolean)

    if (rawMessages.length === 0) return []

    const seen = new Set()

    const filtered = rawMessages.filter((message) => {
      const normalized = normalizeForComparison(message)
      if (!normalized) return false
      if (normalizedTaskMessage && normalized === normalizedTaskMessage) {
        return false
      }
      if (isBreakState && /перерыв/i.test(normalized)) {
        return false
      }
      if (seen.has(normalized)) return false
      seen.add(normalized)
      return true
    })

    return filtered.map((message) => transformHtml(message))
  }, [isBreakState, normalizedTaskMessage, result])

  const shouldShowLastMessage = resultMessages.length > 0
  const statusNotice = useMemo(() => {
    if (error) return null
    if (!isGameStarted && status === 'active') {
      return 'Игра ещё не началась. Ожидайте старта организатора.'
    }
    if (isGameFinished && taskState !== 'completed') {
      return 'Игра завершена. Проверьте результаты в кабинете.'
    }
    return null
  }, [error, isGameFinished, isGameStarted, status, taskState])

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

        if (
          item.refreshOnComplete &&
          remainingSeconds <= 0 &&
          !refreshRequestedRef.current
        ) {
          refreshRequestedRef.current = true
          void router.replace(router.asPath, undefined, { scroll: false })
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
  }, [formattedTaskMessage, isClient, router])

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
              <a
                href="https://t.me/ActQuest_bot"
                className="transition hover:text-primary dark:hover:text-white"
                target="_blank"
                rel="noreferrer"
              >
                Бот в Telegram
              </a>
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
                  onClick={handleSignOut}
                  className="px-4 py-2 text-sm font-semibold text-gray-600 transition border border-gray-300 rounded-full hover:border-blue-400 hover:text-blue-600 dark:border-slate-700 dark:text-slate-200 dark:hover:border-blue-400 dark:hover:text-blue-300"
                >
                  Выйти
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
                            Локация
                          </span>
                          <span className="font-medium text-gray-800 dark:text-slate-100">
                            {location}
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
                {!isGameInfoCollapsed ? (
                  <div className="flex items-center gap-3 pt-2">
                    <Link
                      href={`/${location}/game/${gameId}`}
                      className="text-sm font-semibold text-blue-600 transition hover:underline dark:text-blue-300"
                    >
                      Вернуться к игре
                    </Link>
                    <button
                      type="button"
                      onClick={() => router.replace(router.asPath)}
                      className="text-sm font-semibold text-gray-600 transition hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-300"
                    >
                      Обновить
                    </button>
                  </div>
                ) : null}
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
                <h2 className="text-lg font-semibold text-primary dark:text-white">Текущее задание</h2>
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
                  {resultMessages.map((html, index) => (
                    <div
                      key={`result-message-${index}`}
                      className="text-base leading-relaxed text-gray-700 whitespace-pre-wrap break-words dark:text-slate-200 aq-task-content"
                      dangerouslySetInnerHTML={{ __html: html }}
                    />
                  ))}
                </div>
              </section>
            ) : null}

            <section className="p-6 bg-white shadow-lg rounded-3xl dark:bg-slate-900 dark:border dark:border-slate-800 dark:shadow-slate-950/40">
              <h2 className="text-lg font-semibold text-primary dark:text-white">Ответ на задание</h2>
              <form className="flex flex-col gap-4 mt-4" onSubmit={handleSubmit}>
                <input
                  type="text"
                  value={answer}
                  onChange={(event) => setAnswer(event.target.value)}
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
                  <button
                    type="button"
                    onClick={() => router.push(`/${location}/game/${gameId}/${teamId}`)}
                    className="px-6 py-3 text-sm font-semibold text-gray-600 transition border border-gray-300 rounded-full hover:border-blue-400 hover:text-blue-600 dark:border-slate-700 dark:text-slate-200 dark:hover:border-blue-400 dark:hover:text-blue-300"
                  >
                    Сбросить
                  </button>
                </div>
              </form>
            </section>

            {Array.isArray(result?.images) && result.images.length > 0 ? (
              <section className="p-6 bg-white shadow-lg rounded-3xl dark:bg-slate-900 dark:border dark:border-slate-800 dark:shadow-slate-950/40">
                <h2 className="text-lg font-semibold text-primary dark:text-white">Изображения задания</h2>
                <div className="grid gap-4 mt-4 sm:grid-cols-2">
                  {result.images.map((src, index) => (
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
  }),
  taskHtml: PropTypes.string,
  taskState: PropTypes.oneOf(['idle', 'active', 'break', 'completed']),
  error: PropTypes.string,
  session: PropTypes.shape({}),
  gameId: PropTypes.string.isRequired,
  teamId: PropTypes.string.isRequired,
}

GameTeamPage.defaultProps = {
  game: null,
  team: null,
  result: null,
  taskHtml: '',
  taskState: 'idle',
  error: null,
  session: null,
}

export default GameTeamPage

export const getServerSideProps = async (context) => {
  const { params, req, resolvedUrl, query } = context
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

  const session = await getSession({ req })

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

  try {
    const [game, team] = await Promise.all([
      fetchGame(locationParam, gameIdParam),
      fetchTeam(locationParam, teamIdParam),
    ])

    if (!game || !game._id || !team || !team._id) {
      return { notFound: true }
    }

    const status = game.status || 'active'
    const isGameStarted = status === 'started'
    const isGameFinished = status === 'finished'

    const db = await dbConnect(locationParam)

    if (!db) {
      return {
        props: {
          session,
          location: locationParam,
          game: JSON.parse(JSON.stringify(game)),
          team: JSON.parse(JSON.stringify(team)),
          status,
          isGameStarted,
          isGameFinished,
          result: null,
          taskHtml: '',
          taskState: 'idle',
          error: 'DB_CONNECTION_FAILED',
          gameId: gameIdParam,
          teamId: teamIdParam,
        },
      }
    }

    const gamesTeamsModel = db.model('GamesTeams')
    const teamsUsersModel = db.model('TeamsUsers')

    const gameTeam = await gamesTeamsModel
      .findOne({ gameId: gameIdParam, teamId: teamIdParam })
      .lean()

    if (!gameTeam) {
      return { notFound: true }
    }

    const telegramId = session?.user?.telegramId
    const telegramIdStr = telegramId ? String(telegramId) : null

    let currentTeamUser = null

    if (telegramIdStr) {
      currentTeamUser = await teamsUsersModel
        .findOne({ teamId: teamIdParam, userTelegramId: telegramIdStr })
        .lean()
    }

    if (!currentTeamUser) {
      return {
        redirect: {
          destination: `/${locationParam}/game/${gameIdParam}`,
          permanent: false,
        },
      }
    }

    const messageParam = typeof query.message === 'string' ? query.message : undefined
    const sanitizedMessage =
      messageParam && messageParam !== 'undefined' ? messageParam.trim() : undefined

    const actingTelegramId = currentTeamUser?.userTelegramId

    let processResult = null

    if (actingTelegramId) {
      try {
        processResult = await webGameProcess({
          db,
          game,
          gameTeam,
          gameTeamId: gameTeam._id,
          message: sanitizedMessage,
        })
      } catch (processError) {
        console.error('Game process execution error', processError)
        processResult = { message: 'Не удалось получить текущее состояние задания.' }
      }
    }

    const refreshedGameTeam = await gamesTeamsModel
      .findById(gameTeam._id)
      .lean()

    let effectiveGameTeam = refreshedGameTeam ?? gameTeam

    const tasks = Array.isArray(game.tasks) ? game.tasks : []
    const tasksCount = tasks.length

    const breakDurationSeconds = parseDurationSeconds(game.breakDuration, 0)
    const taskDurationSeconds = parseDurationSeconds(game.taskDuration, 3600)
    const cluesDurationSeconds = parseDurationSeconds(game.cluesDuration, 1200)

    const autoProgressMessages = []

    const maybeHandleAutomaticProgress = async (teamState) => {
      if (!teamState || tasksCount === 0) return teamState

      const activeNumValue = Number.isInteger(teamState?.activeNum)
        ? teamState.activeNum
        : 0
      const clampedIndex = Math.max(
        Math.min(activeNumValue, tasksCount - 1),
        0
      )

      if (activeNumValue >= tasksCount) {
        return teamState
      }

      const nextIndex = clampedIndex + 1
      const hasNextTask = nextIndex < tasksCount

      const startTimes = ensureArrayWithLength(
        teamState.startTime,
        tasksCount,
        null
      )
      const endTimes = ensureArrayWithLength(teamState.endTime, tasksCount, null)

      const activeStart = ensureDateValue(startTimes[clampedIndex])
      const activeEnd = ensureDateValue(endTimes[clampedIndex])
      const nowMs = Date.now()

      const updateActiveNum = async (nextActiveNum, extraUpdates = {}) => {
        const updates = { activeNum: nextActiveNum, ...extraUpdates }
        const updatedTeam = await gamesTeamsModel
          .findByIdAndUpdate(teamState._id, updates, { new: true })
          .lean()

        return updatedTeam ?? { ...teamState, ...updates }
      }

      if (!hasNextTask) {
        if (activeEnd) {
          return updateActiveNum(nextIndex)
        }

        if (activeStart && taskDurationSeconds > 0) {
          const elapsedSinceStart = Math.max(
            Math.floor((nowMs - activeStart.getTime()) / 1000),
            0
          )

          if (elapsedSinceStart >= taskDurationSeconds) {
            return updateActiveNum(nextIndex)
          }
        }

        return teamState
      }

      const advanceToNextTask = async () => {
        const startTimeUpdates = ensureArrayWithLength(
          teamState.startTime,
          tasksCount,
          null
        ).map(cloneDateValue)
        startTimeUpdates[nextIndex] = new Date()

        const forcedCluesUpdates = ensureArrayWithLength(
          teamState.forcedClues,
          tasksCount,
          0
        ).map((value) => (Number.isFinite(value) ? value : 0))
        forcedCluesUpdates[nextIndex] = 0

        return updateActiveNum(nextIndex, {
          startTime: startTimeUpdates,
          forcedClues: forcedCluesUpdates,
        })
      }

      if (activeEnd) {
        if (breakDurationSeconds <= 0) {
          return advanceToNextTask()
        }

        const elapsedAfterEnd = Math.max(
          Math.floor((nowMs - activeEnd.getTime()) / 1000),
          0
        )

        if (elapsedAfterEnd >= breakDurationSeconds) {
          return advanceToNextTask()
        }

        return teamState
      }

      if (activeStart && taskDurationSeconds > 0) {
        const elapsedSinceStart = Math.max(
          Math.floor((nowMs - activeStart.getTime()) / 1000),
          0
        )

        if (elapsedSinceStart >= taskDurationSeconds) {
          if (breakDurationSeconds > 0) {
            if (elapsedSinceStart >= taskDurationSeconds + breakDurationSeconds) {
              autoProgressMessages.push('<b>Перерыв завершён.</b>')
              return advanceToNextTask()
            }
          } else {
            autoProgressMessages.push('<b>Время на задание вышло.</b>')
            return advanceToNextTask()
          }
        }
      }

      return teamState
    }

    effectiveGameTeam = await maybeHandleAutomaticProgress(effectiveGameTeam)

    const activeNumRaw = Number.isInteger(effectiveGameTeam?.activeNum)
      ? effectiveGameTeam.activeNum
      : 0

    if (autoProgressMessages.length > 0) {
      const baseMessages = Array.isArray(processResult?.messages)
        ? [...processResult.messages]
        : []

      if (!processResult?.messages && processResult?.message) {
        baseMessages.push(processResult.message)
      }

      const combinedMessages = [...baseMessages, ...autoProgressMessages].filter(
        Boolean
      )

      processResult = {
        ...(processResult || {}),
        message: processResult?.message || combinedMessages[0] || '',
        messages: combinedMessages,
      }
    }

    const formatSecondsForCountdown = (totalSeconds) => {
      if (!Number.isFinite(totalSeconds)) return '00:00:00'
      const safeSeconds = Math.max(Math.floor(totalSeconds), 0)
      const hours = Math.floor(safeSeconds / 3600)
      const minutes = Math.floor((safeSeconds % 3600) / 60)
      const seconds = safeSeconds % 60
      const pad = (num) => String(num).padStart(2, '0')
      return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
    }

    const createCountdownSpan = (secondsLeft, targetTimestamp) => {
      const attributes = ['data-task-countdown="break"', 'data-refresh-on-complete="true"']
      if (Number.isFinite(targetTimestamp)) {
        attributes.push(`data-target="${targetTimestamp}"`)
      }
      if (Number.isFinite(secondsLeft)) {
        attributes.push(`data-seconds="${secondsLeft}"`)
      }
      return `<span ${attributes.join(' ')}>${formatSecondsForCountdown(
        secondsLeft
      )}</span>`
    }

    let taskHtml = ''
    let taskState = 'idle'

    const hasCompletedAllTasks = tasksCount > 0 && activeNumRaw >= tasksCount

    if (isGameStarted && !isGameFinished && tasksCount > 0) {
      if (hasCompletedAllTasks) {
        const lastTask = tasks[tasksCount - 1] ?? null
        const finishingPlace = game.finishingPlace
        const completionParts = ['<b>Поздравляем! Вы завершили игру.</b>']
        if (finishingPlace) {
          completionParts.push(`<br /><br /><b>Точка сбора:</b> ${finishingPlace}`)
        }
        if (lastTask?.postMessage) {
          completionParts.push(
            `<br /><br /><b>Сообщение от организаторов:</b><br /><blockquote>${lastTask.postMessage}</blockquote>`
          )
        }
        taskHtml = completionParts.join('')
        taskState = 'completed'
      } else {
        const startTimes = ensureArrayWithLength(
          effectiveGameTeam.startTime,
          tasksCount,
          null
        )
        const forcedClues = ensureArrayWithLength(
          effectiveGameTeam.forcedClues,
          tasksCount,
          0
        )
        const endTimes = ensureArrayWithLength(
          effectiveGameTeam.endTime,
          tasksCount,
          null
        )

        const activeTaskIndex = Math.max(
          Math.min(activeNumRaw, tasksCount - 1),
          0
        )
        const activeTaskEndTime = ensureDateValue(endTimes[activeTaskIndex])
        const activeTaskStartTime = ensureDateValue(
          startTimes[activeTaskIndex]
        )

        let breakSecondsLeft = null
        let breakTargetTimestamp = null
        let breakReason = null

        if (breakDurationSeconds > 0) {
          const nowMs = Date.now()

          if (activeTaskEndTime) {
            const elapsed = Math.max(
              Math.floor((nowMs - activeTaskEndTime.getTime()) / 1000),
              0
            )
            if (elapsed < breakDurationSeconds) {
              breakSecondsLeft = breakDurationSeconds - elapsed
              breakTargetTimestamp =
                activeTaskEndTime.getTime() + breakDurationSeconds * 1000
              breakReason = 'success'
            }
          } else if (
            activeTaskStartTime &&
            taskDurationSeconds > 0
          ) {
            const elapsedSinceStart = Math.max(
              Math.floor((nowMs - activeTaskStartTime.getTime()) / 1000),
              0
            )
            if (elapsedSinceStart >= taskDurationSeconds) {
              const overtime = elapsedSinceStart - taskDurationSeconds
              if (overtime < breakDurationSeconds) {
                breakSecondsLeft = breakDurationSeconds - overtime
                breakTargetTimestamp =
                  activeTaskStartTime.getTime() +
                  (taskDurationSeconds + breakDurationSeconds) * 1000
                breakReason = 'timeout'
              }
            }
          }
        }

        if (breakSecondsLeft !== null) {
          const postMessage = tasks[activeTaskIndex]?.postMessage
          const breakParts = [
            breakReason === 'timeout'
              ? '<b>Время на задание вышло.</b>'
              : '<b>Задание выполнено.</b>',
          ]
          if (postMessage) {
            breakParts.push(
              `<br /><br /><b>Сообщение от организаторов:</b><br /><blockquote>${postMessage}</blockquote>`
            )
          }
          breakParts.push('<br /><br /><b>Перерыв.</b>')
          breakParts.push(
            '<br /><br /><b>Ожидайте следующее задание после перерыва.</b>'
          )
          breakParts.push(
            `<br /><br /><b>Время до окончания перерыва:</b> ${createCountdownSpan(
              breakSecondsLeft,
              breakTargetTimestamp
            )}`
          )
          taskHtml = breakParts.join('')
          taskState = 'break'
        } else {
          let elapsedSeconds = 0
          if (activeTaskStartTime) {
            elapsedSeconds = Math.max(
              Math.floor((Date.now() - activeTaskStartTime.getTime()) / 1000),
              0
            )
          }

          const forcedCluesCount = Math.max(
            forcedClues[activeTaskIndex] ?? 0,
            0
          )
          const timedCluesCount =
            cluesDurationSeconds > 0
              ? Math.max(
                  Math.floor(elapsedSeconds / cluesDurationSeconds),
                  0
                )
              : 0
          const visibleCluesCount = Math.max(timedCluesCount, forcedCluesCount)

          taskHtml = taskText({
            game,
            taskNum: activeTaskIndex,
            findedCodes: effectiveGameTeam.findedCodes,
            findedBonusCodes: effectiveGameTeam.findedBonusCodes,
            findedPenaltyCodes: effectiveGameTeam.findedPenaltyCodes,
            startTaskTime: activeTaskStartTime,
            cluesDuration: cluesDurationSeconds,
            taskDuration: taskDurationSeconds,
            photos: effectiveGameTeam.photos,
            timeAddings: effectiveGameTeam.timeAddings,
            visibleCluesCount,
            includeActionPrompt: false,
            format: 'web',
          })
          taskState = 'active'
        }
      }
    }

    if (!taskHtml && (hasCompletedAllTasks || isGameFinished) && tasksCount > 0) {
      const lastTask = tasks[tasksCount - 1] ?? null
      const finishingPlace = game.finishingPlace
      const completionParts = ['<b>Поздравляем! Вы завершили игру.</b>']
      if (finishingPlace) {
        completionParts.push(`<br /><br /><b>Точка сбора:</b> ${finishingPlace}`)
      }
      if (lastTask?.postMessage) {
        completionParts.push(
          `<br /><br /><b>Сообщение от организаторов:</b><br /><blockquote>${lastTask.postMessage}</blockquote>`
        )
      }
      taskHtml = completionParts.join('')
      taskState = 'completed'
    }

    return {
      props: {
        session,
        location: locationParam,
        game: JSON.parse(JSON.stringify(game)),
        team: JSON.parse(JSON.stringify(team)),
        status,
        isGameStarted,
        isGameFinished,
        result: processResult ? JSON.parse(JSON.stringify(processResult)) : null,
        taskHtml,
        taskState,
        error: null,
        gameId: gameIdParam,
        teamId: teamIdParam,
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
        error: 'UNKNOWN_ERROR',
        gameId: gameIdParam,
        teamId: teamIdParam,
      },
    }
  }
}
