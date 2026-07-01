'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Modal from '@components/Modal'
import TiptapContentView from '@components/cabinet/TiptapContentView'
import formatDateInLocationTimeZone from '@helpers/formatDateInLocationTimeZone'
import requestApiJson from '@helpers/requestApiJson'
import {
  buildDefaultPrequelProgress,
  isPrequelOpenForDate,
  isPrequelReadyForPlayers,
  isPrequelProgressClosedForConfig,
  isPrequelProgressExhaustedForConfig,
  normalizePrequelConfig,
  normalizePrequelProgress,
} from '@helpers/normalizePrequel'

const statusLabels = {
  active: 'Ещё не началась',
  started: 'В процессе',
  finished: 'Завершена',
}

const formatDateTime = (value, locationKey) =>
  formatDateInLocationTimeZone(value, locationKey, {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })

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

const buildAcceptedPrequelCodeItems = (progress, source) =>
  (Array.isArray(progress?.appliedAdjustments) ? progress.appliedAdjustments : [])
    .filter((item) => item?.source === source && String(item?.code || '').trim())
    .map((item) => ({
      code: String(item.code || '').trim(),
      description: String(item.description || '').trim(),
    }))

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
    () => formatDateTime(game?.dateStart, location),
    [game?.dateStart, location],
  )
  const actualStart = useMemo(
    () => formatDateTime(game?.dateStartFact, location),
    [game?.dateStartFact, location],
  )
  const actualFinish = useMemo(
    () => formatDateTime(game?.dateEndFact, location),
    [game?.dateEndFact, location],
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
  const captainParticipantTeam = useMemo(
    () =>
      participantTeams.find((team) => Boolean(team?.isCaptain)) ||
      participantTeams[0] ||
      null,
    [participantTeams],
  )
  const participantTeamId = participantTeam?.id
    ? String(participantTeam.id)
    : null
  const captainGameTeamId = captainParticipantTeam?.gameTeamId
    ? String(captainParticipantTeam.gameTeamId)
    : ''
  const prequel = useMemo(
    () => normalizePrequelConfig(game?.prequel, { includeCodes: false }),
    [game?.prequel],
  )
  const [prequelNowTs, setPrequelNowTs] = useState(() => Date.now())
  const isPrequelOpen = useMemo(
    () => isPrequelOpenForDate(prequel, new Date(prequelNowTs)),
    [prequel, prequelNowTs],
  )
  const isPrequelReady = useMemo(
    () => isPrequelReadyForPlayers(prequel),
    [prequel],
  )
  const prequelOpenAtLabel = useMemo(
    () => formatDateTime(prequel.openAt, location),
    [prequel.openAt, location],
  )
  const initialPrequelProgress = useMemo(
    () =>
      normalizePrequelProgress(captainParticipantTeam?.prequelProgress) ||
      buildDefaultPrequelProgress(),
    [captainParticipantTeam?.prequelProgress],
  )
  const canEnterGame = isGameStarted && !isGameFinished
  const showParticipantInfo = Boolean(participantTeamId && isParticipant)

  const [prequelCode, setPrequelCode] = useState('')
  const [prequelFeedback, setPrequelFeedback] = useState(null)
  const [prequelProgress, setPrequelProgress] = useState(initialPrequelProgress)
  const [isPrequelSubmitting, setIsPrequelSubmitting] = useState(false)
  const [isPrequelHelpOpen, setIsPrequelHelpOpen] = useState(false)
  const isPrequelExhausted = useMemo(
    () => isPrequelProgressExhaustedForConfig(prequelProgress, prequel),
    [prequel, prequelProgress],
  )
  const isPrequelClosed = useMemo(
    () => isPrequelProgressClosedForConfig(prequelProgress, prequel),
    [prequel, prequelProgress],
  )
  const acceptedBonusCodeItems = useMemo(
    () => buildAcceptedPrequelCodeItems(prequelProgress, 'bonus_code'),
    [prequelProgress],
  )
  const acceptedPenaltyCodeItems = useMemo(
    () => buildAcceptedPrequelCodeItems(prequelProgress, 'penalty_code'),
    [prequelProgress],
  )
  const canUsePrequel =
    Boolean(prequel.enabled) &&
    isPrequelReady &&
    isPrequelOpen &&
    Boolean(captainGameTeamId) &&
    Boolean(captainParticipantTeam?.isCaptain) &&
    !isPrequelClosed &&
    !isGameStarted &&
    !isGameFinished
  const prequelStatusMessage =
    !isPrequelOpen
      ? `Задание приквела будет открыто ${prequelOpenAtLabel || 'в указанную дату и время'}.`
      : isGameStarted || isGameFinished
      ? 'После фактического старта игры ввод приквела недоступен.'
      : isPrequelExhausted
        ? 'Все доступные коды приквела для вашей команды уже найдены.'
      : isPrequelClosed
        ? 'Приквел уже закрыт для вашей команды после первого найденного кода.'
        : 'Ввод приквела доступен только капитану зарегистрированной команды.'

  useEffect(() => {
    setPrequelProgress(initialPrequelProgress)
  }, [initialPrequelProgress])

  useEffect(() => {
    if (!prequel.openAt || isPrequelOpen) {
      return undefined
    }

    const intervalId = window.setInterval(() => {
      setPrequelNowTs(Date.now())
    }, 30000)

    return () => window.clearInterval(intervalId)
  }, [isPrequelOpen, prequel.openAt])

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

  const handleSubmitPrequel = useCallback(
    async (event) => {
      event.preventDefault()
      if (!canUsePrequel || !captainGameTeamId) {
        return
      }

      const trimmedCode = prequelCode.trim()
      if (!trimmedCode) {
        setPrequelFeedback({ type: 'error', message: 'Введите код приквела' })
        return
      }

      setIsPrequelSubmitting(true)
      setPrequelFeedback(null)

      try {
        const { json } = await requestApiJson('/api/webapp/game-prequel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            gameTeamId: captainGameTeamId,
            code: trimmedCode,
          }),
          fallbackMessage: 'Не удалось отправить код приквела',
        })

        setPrequelProgress(
          normalizePrequelProgress(json?.progress || buildDefaultPrequelProgress()),
        )
        setPrequelFeedback({
          type:
            json?.matchedCategory === 'wrong'
              ? 'info'
              : json?.matchedCategory === 'penalty'
                ? 'error'
                : 'success',
          message: json?.message || 'Код приквела обработан',
        })
        setPrequelCode('')
      } catch (error) {
        setPrequelFeedback({
          type: 'error',
          message: error?.message || 'Не удалось отправить код приквела',
        })
      } finally {
        setIsPrequelSubmitting(false)
      }
    },
    [canUsePrequel, captainGameTeamId, prequelCode],
  )

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
                {isPrequelReady ? (
                  <div className="mt-5 rounded-2xl border border-cyan-200 bg-cyan-50/70 p-4 dark:border-cyan-500/35 dark:bg-cyan-500/10">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-start justify-between gap-3">
                        <h2 className="text-lg font-semibold text-cyan-900 dark:text-cyan-100">
                          Приквел
                        </h2>
                        <button
                          type="button"
                          onClick={() => setIsPrequelHelpOpen(true)}
                          className="shrink-0 text-xs font-semibold text-cyan-700 underline underline-offset-2 transition hover:text-cyan-900 dark:text-cyan-200 dark:hover:text-cyan-100"
                        >
                          Что такое приквел?
                        </button>
                      </div>
                      <div className="border-t border-cyan-200/80 dark:border-cyan-500/20" />
                      {isPrequelOpen ? (
                        <TiptapContentView
                          html={prequel.descriptionRich}
                          text={prequel.description}
                          emptyText="Описание приквела пока не заполнено."
                          className="mt-3 text-sm text-slate-700 dark:prose-invert dark:text-slate-200"
                          textClassName="mt-3 text-sm text-slate-700 dark:text-slate-200"
                          emptyClassName="text-sm text-slate-500"
                        />
                      ) : (
                        <p className="mt-3 text-sm font-medium text-cyan-900 dark:text-cyan-100">
                          {prequelStatusMessage}
                        </p>
                      )}
                      <div className="border-t border-cyan-200/80 dark:border-cyan-500/20" />
                      {isPrequelOpen && Number(prequel.wrongAttemptsLimit) > 0 ? (
                        <p className="text-xs text-cyan-800 dark:text-cyan-200">
                          Внимание: каждые {prequel.wrongAttemptsLimit} неверных кодов
                          дают штраф.
                        </p>
                      ) : null}
                    </div>

                    {canUsePrequel ? (
                      <form className="mt-4 flex flex-col gap-3" onSubmit={handleSubmitPrequel}>
                        <div className="flex flex-col gap-3 sm:flex-row">
                          <input
                            type="text"
                            value={prequelCode}
                            onChange={(event) => setPrequelCode(event.target.value)}
                            placeholder="Введите код приквела"
                            className="w-full rounded-xl border border-cyan-200 bg-white px-4 py-3 text-sm text-slate-800 focus:border-cyan-500 focus:outline-none dark:border-cyan-400/30 dark:bg-slate-900/70 dark:text-white"
                          />
                          <button
                            type="submit"
                            disabled={isPrequelSubmitting}
                            className="inline-flex items-center justify-center rounded-xl bg-cyan-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isPrequelSubmitting ? 'Отправка...' : 'Отправить код'}
                          </button>
                        </div>
                      </form>
                    ) : isPrequelOpen ? (
                      <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
                        {prequelStatusMessage}
                      </p>
                    ) : null}

                    {isPrequelOpen && prequelFeedback ? (
                      <div
                        className={`mt-3 rounded-xl px-3 py-2 text-sm ${
                          prequelFeedback.type === 'error'
                            ? 'border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200'
                            : prequelFeedback.type === 'info'
                              ? 'border border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-200'
                            : 'border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200'
                        }`}
                      >
                        {prequelFeedback.message}
                      </div>
                    ) : null}

                    {isPrequelOpen ? (
                      <p className="mt-3 text-xs text-slate-600 dark:text-slate-300">
                        Неверных кодов: {prequelProgress.wrongCodes.length}
                      </p>
                    ) : null}

                    {isPrequelOpen && acceptedBonusCodeItems.length > 0 ? (
                      <div className="mt-3">
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-100">
                          Принятые бонусные коды:
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {acceptedBonusCodeItems.map((item, index) => (
                            <span
                              key={`prequel-bonus-code-${index}-${item.code}`}
                              className="inline-flex items-center rounded-full border border-emerald-300/70 bg-emerald-50/90 px-3 py-1 text-xs font-semibold tracking-wide text-emerald-800 dark:border-emerald-500/50 dark:bg-emerald-500/15 dark:text-emerald-100"
                              title={item.description || undefined}
                            >
                              {item.code}
                              {item.description ? ` — ${item.description}` : ''}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {isPrequelOpen && acceptedPenaltyCodeItems.length > 0 ? (
                      <div className="mt-3">
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-100">
                          Принятые штрафные коды:
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {acceptedPenaltyCodeItems.map((item, index) => (
                            <span
                              key={`prequel-penalty-code-${index}-${item.code}`}
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
                  </div>
                ) : null}
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
                  {game?.showFinishingPlace && game?.finishingPlace ? (
                    <div className="flex flex-col">
                      <span className="text-xs text-gray-400 uppercase dark:text-slate-500">
                        Финиш
                      </span>
                      <span className="font-medium text-gray-800 dark:text-slate-100">
                        {game.finishingPlace}
                      </span>
                    </div>
                  ) : null}
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
      <Modal
        isOpen={isPrequelHelpOpen}
        onClose={() => setIsPrequelHelpOpen(false)}
        title="Что такое приквел?"
        compactMobile
      >
        <div className="space-y-3 text-sm text-slate-700 dark:text-slate-200">
          <p>
            Приквел — это дополнительное задание для всех команд,
            зарегистрированных на игру, которое доступно до фактического старта.
          </p>
          <p>
            Капитан зарегистрированной команды может вводить коды приквела прямо
            на странице игры после его открытия. Верные коды дают бонус, а
            некоторые коды или серии неверных попыток могут дать штраф.
          </p>
          <p>
            После фактического старта игры ввод приквела закрывается, а
            полученные корректировки учитываются в результате команды.
          </p>
        </div>
      </Modal>
    </>
  )
}

export default GameEntryPage
