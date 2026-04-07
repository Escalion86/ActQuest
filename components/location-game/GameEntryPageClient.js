'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import TiptapContentView from '@components/cabinet/TiptapContentView'

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

const splitDescription = (value) => {
  if (!value) return []

  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

const formatCityName = (locationKey) => {
  if (!locationKey || typeof locationKey !== 'string') {
    return 'Не указан'
  }

  const normalized = locationKey.trim().toLowerCase()
  if (normalized === 'krsk' || normalized === 'dev') {
    return 'Красноярск'
  }
  if (normalized === 'nrsk') {
    return 'Норильск'
  }
  if (normalized === 'ekb') {
    return 'Екатеринбург'
  }

  const safe = locationKey.trim()
  return safe ? safe.charAt(0).toUpperCase() + safe.slice(1) : 'Не указан'
}

function GameEntryPage({
  location,
  game,
  participantTeams,
  isParticipant,
  isGameStarted,
  isGameFinished,
  status,
  session: initialSession,
  error,
}) {
  const { data: session } = useSession()
  const router = useRouter()

  const [theme, setTheme] = useState('light')
  const [isClient, setIsClient] = useState(false)

  const resolvedSession = session ?? initialSession

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    if (!isClient) return

    const storedTheme =
      window.localStorage.getItem('cabinet-theme') ||
      window.localStorage.getItem('aq-theme')
    if (storedTheme === 'light' || storedTheme === 'dark') {
      setTheme(storedTheme)
      return
    }

    const prefersDark = window.matchMedia?.(
      '(prefers-color-scheme: dark)',
    ).matches
    setTheme(prefersDark ? 'dark' : 'light')
  }, [isClient])

  useEffect(() => {
    if (!isClient) return

    window.document.documentElement.classList.toggle('dark', theme === 'dark')
    window.document.documentElement.setAttribute('data-theme', theme)
    window.localStorage.setItem('cabinet-theme', theme)
    window.localStorage.setItem('aq-theme', theme)
  }, [theme, isClient])

  const handleThemeToggle = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }

  const handleGoToCabinet = useCallback(() => {
    router.push('/cabinet')
  }, [router])

  const plannedStart = useMemo(
    () => formatDateTime(game?.dateStart),
    [game?.dateStart],
  )
  const actualStart = useMemo(
    () => formatDateTime(game?.dateStartFact),
    [game?.dateStartFact],
  )
  const actualFinish = useMemo(
    () => formatDateTime(game?.dateEndFact),
    [game?.dateEndFact],
  )

  const descriptionParts = useMemo(
    () => splitDescription(game?.description ?? ''),
    [game?.description],
  )
  const descriptionRich = useMemo(
    () =>
      typeof game?.descriptionRich === 'string'
        ? game.descriptionRich.trim()
        : '',
    [game?.descriptionRich],
  )

  const statusLabel = statusLabels[status] ?? 'Статус неизвестен'
  const cityName = useMemo(() => formatCityName(location), [location])
  const participantTeam = useMemo(
    () => (participantTeams.length > 0 ? participantTeams[0] : null),
    [participantTeams],
  )
  const participantTeamId = participantTeam?.id
    ? String(participantTeam.id)
    : null
  const canEnterGame = isGameStarted && !isGameFinished
  const showParticipantInfo = Boolean(participantTeamId && isParticipant)

  const [isGameIdCopied, setIsGameIdCopied] = useState(false)
  const gameIdCopyTimeoutRef = useRef(null)

  useEffect(
    () => () => {
      if (gameIdCopyTimeoutRef.current) {
        clearTimeout(gameIdCopyTimeoutRef.current)
      }
    },
    [],
  )

  const gameIdString = game?._id ? String(game._id) : ''
  const isHiddenGame = Boolean(game?.hidden)

  const handleCopyGameId = useCallback(() => {
    if (!gameIdString || typeof window === 'undefined') {
      return
    }

    const copyPromise = navigator?.clipboard?.writeText
      ? navigator.clipboard.writeText(gameIdString)
      : Promise.reject(new Error('Clipboard API unavailable'))

    copyPromise
      .then(() => {
        setIsGameIdCopied(true)
        if (gameIdCopyTimeoutRef.current) {
          clearTimeout(gameIdCopyTimeoutRef.current)
        }
        gameIdCopyTimeoutRef.current = setTimeout(() => {
          setIsGameIdCopied(false)
          gameIdCopyTimeoutRef.current = null
        }, 2000)
      })
      .catch(() => {
        setIsGameIdCopied(false)
      })
  }, [gameIdString])

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
                {theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
              </button>
              {resolvedSession ? (
                <button
                  type="button"
                  onClick={handleGoToCabinet}
                  className="px-4 py-2 text-sm font-semibold text-gray-600 transition border border-gray-300 rounded-full hover:border-blue-400 hover:text-blue-600 dark:border-slate-700 dark:text-slate-200 dark:hover:border-blue-400 dark:hover:text-blue-300"
                >
                  Вернуться в кабинет
                </button>
              ) : null}
            </div>
          </div>
        </header>

        <main className="px-4">
          <div className="flex flex-col w-full max-w-5xl gap-8 mx-auto mt-10">
            <div className="flex flex-col gap-6 p-6 bg-white shadow-lg rounded-3xl dark:bg-slate-900 dark:border dark:border-slate-800 dark:shadow-slate-950/40">
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                  <h1 className="text-2xl font-semibold text-primary dark:text-white">
                    {game?.name || 'Игра'}
                  </h1>
                  <span className="px-3 py-1 text-xs font-semibold text-blue-700 uppercase bg-blue-100 border border-blue-200 rounded-full dark:bg-blue-500/10 dark:border-blue-400/40 dark:text-blue-200">
                    {statusLabel}
                  </span>
                </div>
                <TiptapContentView
                  html={descriptionRich}
                  text={descriptionParts.join('\n')}
                  className="prose-slate text-base leading-relaxed text-gray-700 dark:prose-invert dark:text-slate-200"
                  textClassName="text-base leading-relaxed text-gray-700 dark:text-slate-200"
                  emptyText=""
                />
                <div className="grid gap-3 text-sm text-gray-600 sm:grid-cols-2 dark:text-slate-300">
                  <div className="flex flex-col">
                    <span className="text-xs text-gray-400 uppercase dark:text-slate-500">
                      Город
                    </span>
                    <span className="font-medium text-gray-800 dark:text-slate-100">
                      {cityName}
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
                  {game?.startingPlace ? (
                    <div className="flex flex-col">
                      <span className="text-xs text-gray-400 uppercase dark:text-slate-500">
                        Место старта
                      </span>
                      <span className="font-medium text-gray-800 dark:text-slate-100">
                        {game.startingPlace}
                      </span>
                    </div>
                  ) : null}
                  {/* {game?.finishingPlace ? (
                    <div className="flex flex-col">
                      <span className="text-xs text-gray-400 uppercase dark:text-slate-500">
                        Место финиша
                      </span>
                      <span className="font-medium text-gray-800 dark:text-slate-100">
                        {game.finishingPlace}
                      </span>
                    </div>
                  ) : null} */}
                </div>
              </div>

              {isHiddenGame && gameIdString ? (
                <div className="flex flex-col gap-2 px-4 py-3 border border-dashed rounded-2xl border-primary/40 bg-blue-50/70 dark:bg-blue-500/10 dark:border-blue-400/30">
                  <div className="text-xs font-semibold text-gray-500 uppercase dark:text-slate-400">
                    ID игры для присоединения
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyGameId}
                    className="inline-flex items-center justify-between w-full px-3 py-2 text-sm font-medium transition border border-dashed rounded-lg border-primary/40 bg-white/80 text-primary hover:bg-blue-100 dark:bg-slate-800/60 dark:text-blue-300 dark:hover:bg-slate-700/60 dark:border-blue-400/30"
                  >
                    <span className="font-mono">{gameIdString}</span>
                    <span className="text-[11px] font-normal uppercase tracking-wide">
                      {isGameIdCopied
                        ? 'Скопировано ✓'
                        : 'Нажмите, чтобы скопировать'}
                    </span>
                  </button>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    Эта игра скрыта. Отправьте этот ID другим игрокам, чтобы они
                    могли найти и присоединиться к игре.
                  </p>
                </div>
              ) : null}

              {error ? (
                <div className="px-4 py-3 text-sm text-red-600 border border-red-200 rounded-2xl bg-red-50 dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-300">
                  {error === 'DB_CONNECTION_FAILED'
                    ? 'Не удалось подключиться к базе данных. Попробуйте обновить страницу позднее.'
                    : 'Произошла ошибка при загрузке данных об игре.'}
                </div>
              ) : null}

              {!isGameStarted && !isGameFinished ? (
                <div className="px-4 py-4 border border-yellow-200 rounded-2xl bg-yellow-50 dark:bg-amber-500/10 dark:border-amber-500/40">
                  <h2 className="text-lg font-semibold text-yellow-900 dark:text-amber-200">
                    Игра ещё не началась
                  </h2>
                  <p className="mt-2 text-sm text-yellow-800 dark:text-amber-100">
                    Мы сообщим, когда организаторы запустят игру. Пока вы не
                    можете перейти к заданиям.
                  </p>
                </div>
              ) : null}

              {isGameFinished ? (
                <div className="px-4 py-4 border border-emerald-200 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 dark:border-emerald-500/40">
                  <h2 className="text-lg font-semibold text-emerald-900 dark:text-emerald-200">
                    Игра завершена
                  </h2>
                  <p className="mt-2 text-sm text-emerald-800 dark:text-emerald-100">
                    Организаторы остановили игру. Вы можете посмотреть
                    результаты или перейти в карточку своей команды ниже.
                  </p>
                </div>
              ) : null}

              {isGameStarted && !isParticipant ? (
                <div className="px-4 py-4 border border-red-200 rounded-2xl bg-red-50 dark:bg-red-500/10 dark:border-red-500/40">
                  <h2 className="text-lg font-semibold text-red-900 dark:text-red-200">
                    Вы не участвуете в этой игре
                  </h2>
                  <p className="mt-2 text-sm text-red-800 dark:text-red-100">
                    Судя по нашим данным, вас нет ни в одной команде,
                    зарегистрированной на игру. Если это ошибка, свяжитесь с
                    организатором.
                  </p>
                </div>
              ) : null}

              {showParticipantInfo ? (
                <div className="flex flex-col gap-3 p-4 border border-gray-200 rounded-2xl bg-gray-50 dark:bg-slate-800/60 dark:border-slate-700">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-base font-medium text-gray-800 dark:text-slate-100">
                      Вы участвуете в игре в команде{' '}
                      <span className="font-semibold">
                        {participantTeam.name || 'Команда без названия'}
                      </span>
                    </div>
                    {canEnterGame ? (
                      <Link
                        href={`/game/${game?._id}/process/${participantTeamId}`}
                        className="inline-flex items-center justify-center px-6 py-3 text-sm font-extrabold tracking-wide text-white transition bg-blue-600 rounded-xl hover:bg-blue-700"
                      >
                        ЗАЙТИ В ИГРУ
                      </Link>
                    ) : null}
                  </div>
                  {!canEnterGame && !isGameFinished ? (
                    <p className="text-sm text-gray-600 dark:text-slate-300">
                      Дождитесь старта игры, чтобы перейти к заданиям.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </main>
      </div>
    </>
  )
}

export default GameEntryPage
