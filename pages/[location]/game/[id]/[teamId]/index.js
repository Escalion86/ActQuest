import PropTypes from 'prop-types'
import { useEffect, useMemo, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { getSession, signOut, useSession } from 'next-auth/react'

import fetchGame from '@server/fetchGame'
import fetchTeam from '@server/fetchTeam'
import gameProcess from '@server/gameProcess'
import dbConnect from '@utils/dbConnect'
import taskText from 'telegram/func/taskText'

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
  return value.replace(/\n/g, '<br />')
}

const normalizeForComparison = (value) =>
  (value || '')
    .replace(/<br\s*\/?>(\s|\u00a0)*/gi, '\n')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\r?\n/g, '\n')
    .replace(/\s+/g, ' ')
    .trim()

function GameTeamPage({
  location,
  game,
  team,
  status,
  isGameStarted,
  isGameFinished,
  result,
  taskHtml,
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

  const formattedResultMessage = useMemo(
    () => transformHtml(result?.message ?? ''),
    [result?.message]
  )

  const formattedTaskMessage = useMemo(() => transformHtml(taskHtml ?? ''), [taskHtml])
  const shouldShowLastMessage = useMemo(() => {
    if (!formattedResultMessage) {
      return false
    }

    const normalizedTaskMessage = normalizeForComparison(taskHtml)
    const normalizedResultMessage = normalizeForComparison(result?.message)

    if (normalizedTaskMessage && normalizedTaskMessage === normalizedResultMessage) {
      return false
    }

    return true
  }, [formattedResultMessage, result?.message, taskHtml])
  const statusNotice = useMemo(() => {
    if (error) return null
    if (!isGameStarted && status === 'active') {
      return 'Игра ещё не началась. Ожидайте старта организатора.'
    }
    if (isGameFinished) {
      return 'Игра завершена. Проверьте результаты в кабинете.'
    }
    return null
  }, [error, isGameFinished, isGameStarted, status])

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
                    className="self-start px-4 py-2 text-sm font-semibold text-gray-600 transition border border-gray-300 rounded-full hover:border-blue-400 hover:text-blue-600 dark:border-slate-700 dark:text-slate-200 dark:hover:border-blue-400 dark:hover:text-blue-300"
                  >
                    {isGameInfoCollapsed ? 'Развернуть' : 'Свернуть'}
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
                  className="mt-4 text-base leading-relaxed text-gray-700 whitespace-pre-wrap break-words dark:text-slate-200"
                  dangerouslySetInnerHTML={{ __html: formattedTaskMessage }}
                />
              </section>
            ) : null}

            {shouldShowLastMessage ? (
              <section className="p-6 bg-white shadow-lg rounded-3xl dark:bg-slate-900 dark:border dark:border-slate-800 dark:shadow-slate-950/40">
                <h2 className="text-lg font-semibold text-primary dark:text-white">Последнее сообщение</h2>
                <div
                  className="mt-4 text-base leading-relaxed text-gray-700 whitespace-pre-wrap break-words dark:text-slate-200"
                  dangerouslySetInnerHTML={{ __html: formattedResultMessage }}
                />
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
    messages: PropTypes.arrayOf(PropTypes.string),
  }),
  taskHtml: PropTypes.string,
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
      const commandPayload = {
        gameTeamId: String(gameTeam._id),
      }

      if (sanitizedMessage) {
        commandPayload.message = sanitizedMessage
      }

      try {
        processResult = await gameProcess({
          telegramId: actingTelegramId,
          jsonCommand: commandPayload,
          location: locationParam,
          db,
        })
      } catch (processError) {
        console.error('Game process execution error', processError)
        processResult = { message: 'Не удалось получить текущее состояние задания.' }
      }
    }

    const refreshedGameTeam = await gamesTeamsModel
      .findById(gameTeam._id)
      .lean()

    const effectiveGameTeam = refreshedGameTeam ?? gameTeam

    let taskHtml = ''

    if (
      isGameStarted &&
      !isGameFinished &&
      effectiveGameTeam &&
      typeof effectiveGameTeam.activeNum === 'number' &&
      Array.isArray(game.tasks) &&
      effectiveGameTeam.activeNum < game.tasks.length
    ) {
      const activeNum = effectiveGameTeam.activeNum
      const startTimes = Array.isArray(effectiveGameTeam.startTime)
        ? effectiveGameTeam.startTime
        : []
      const forcedClues = Array.isArray(effectiveGameTeam.forcedClues)
        ? effectiveGameTeam.forcedClues
        : []
      const startTaskTimeRaw = startTimes[activeNum]
      const startTaskTime = startTaskTimeRaw ? new Date(startTaskTimeRaw) : null
      const resolvedCluesDuration = Number(game.cluesDuration)
      const resolvedTaskDuration = Number(game.taskDuration)
      const cluesDuration = Number.isFinite(resolvedCluesDuration)
        ? resolvedCluesDuration
        : 1200
      const taskDuration = Number.isFinite(resolvedTaskDuration)
        ? resolvedTaskDuration
        : 3600

      let elapsedSeconds = 0
      if (startTaskTime instanceof Date && !Number.isNaN(startTaskTime.getTime())) {
        elapsedSeconds = Math.max(
          Math.floor((Date.now() - startTaskTime.getTime()) / 1000),
          0
        )
      }

      const forcedCluesCount = Math.max(forcedClues[activeNum] ?? 0, 0)
      const timedCluesCount =
        cluesDuration > 0 ? Math.max(Math.floor(elapsedSeconds / cluesDuration), 0) : 0
      const visibleCluesCount = Math.max(timedCluesCount, forcedCluesCount)

      taskHtml = taskText({
        game,
        taskNum: activeNum,
        findedCodes: effectiveGameTeam.findedCodes,
        findedBonusCodes: effectiveGameTeam.findedBonusCodes,
        findedPenaltyCodes: effectiveGameTeam.findedPenaltyCodes,
        startTaskTime,
        cluesDuration,
        taskDuration,
        photos: effectiveGameTeam.photos,
        timeAddings: effectiveGameTeam.timeAddings,
        visibleCluesCount,
      })
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
        error: 'UNKNOWN_ERROR',
        gameId: gameIdParam,
        teamId: teamIdParam,
      },
    }
  }
}
