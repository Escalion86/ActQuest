import { useEffect, useMemo, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { signOut, useSession } from 'next-auth/react'
import { getServerSession } from 'next-auth/next'

import fetchGame from '@server/fetchGame'
import dbConnect from '@utils/dbConnect'

import { authOptions } from '@pages/api/auth/[...nextauth]'

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

  const handleThemeToggle = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }

  const handleSignOut = async () => {
    await signOut({ redirect: false })
    router.push('/')
  }

  const plannedStart = useMemo(() => formatDateTime(game?.dateStart), [game?.dateStart])
  const actualStart = useMemo(
    () => formatDateTime(game?.dateStartFact),
    [game?.dateStartFact]
  )
  const actualFinish = useMemo(
    () => formatDateTime(game?.dateEndFact),
    [game?.dateEndFact]
  )

  const descriptionParts = useMemo(
    () => splitDescription(game?.description ?? ''),
    [game?.description]
  )

  const statusLabel = statusLabels[status] ?? 'Статус неизвестен'
  const participantTeam = useMemo(
    () => (participantTeams.length > 0 ? participantTeams[0] : null),
    [participantTeams]
  )
  const participantTeamId = participantTeam?.id
    ? String(participantTeam.id)
    : null
  const canEnterGame = isGameStarted && !isGameFinished
  const showParticipantInfo = Boolean(participantTeamId && isParticipant)

  return (
    <>
      <Head>
        <title>{`ActQuest — ${game?.name ? `Игра «${game.name}»` : 'Игра'}`}</title>
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
                <div className="text-sm text-gray-500 dark:text-slate-400">
                  Локация: <span className="font-medium text-gray-700 dark:text-slate-200">{location}</span>
                </div>
                {descriptionParts.length > 0 ? (
                  <div className="flex flex-col gap-2 text-base leading-relaxed text-gray-700 dark:text-slate-200">
                    {descriptionParts.map((part, index) => (
                      <p key={`description-${index}`}>{part}</p>
                    ))}
                  </div>
                ) : null}
                <div className="grid gap-3 text-sm text-gray-600 sm:grid-cols-2 dark:text-slate-300">
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
                  {game?.startingPlace ? (
                    <div className="flex flex-col">
                      <span className="text-xs uppercase text-gray-400 dark:text-slate-500">
                        Место старта
                      </span>
                      <span className="font-medium text-gray-800 dark:text-slate-100">
                        {game.startingPlace}
                      </span>
                    </div>
                  ) : null}
                  {game?.finishingPlace ? (
                    <div className="flex flex-col">
                      <span className="text-xs uppercase text-gray-400 dark:text-slate-500">
                        Место финиша
                      </span>
                      <span className="font-medium text-gray-800 dark:text-slate-100">
                        {game.finishingPlace}
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>

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
                    Мы сообщим, когда организаторы запустят игру. Пока вы не можете перейти к заданиям.
                  </p>
                </div>
              ) : null}

              {isGameFinished ? (
                <div className="px-4 py-4 border border-emerald-200 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 dark:border-emerald-500/40">
                  <h2 className="text-lg font-semibold text-emerald-900 dark:text-emerald-200">
                    Игра завершена
                  </h2>
                  <p className="mt-2 text-sm text-emerald-800 dark:text-emerald-100">
                    Организаторы остановили игру. Вы можете посмотреть результаты или перейти в карточку своей команды ниже.
                  </p>
                </div>
              ) : null}

              {isGameStarted && !isParticipant ? (
                <div className="px-4 py-4 border border-red-200 rounded-2xl bg-red-50 dark:bg-red-500/10 dark:border-red-500/40">
                  <h2 className="text-lg font-semibold text-red-900 dark:text-red-200">
                    Вы не участвуете в этой игре
                  </h2>
                  <p className="mt-2 text-sm text-red-800 dark:text-red-100">
                    Судя по нашим данным, вас нет ни в одной команде, зарегистрированной на игру. Если это ошибка, свяжитесь с организатором.
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
                        href={`/${location}/game/${game?._id}/${participantTeamId}`}
                        className="inline-flex items-center justify-center px-6 py-3 text-sm font-extrabold tracking-wide text-white transition rounded-xl bg-blue-600 hover:bg-blue-700"
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

export const getServerSideProps = async (context) => {
  const { params, req, res, resolvedUrl } = context
  const locationParam = params?.location
  const gameIdParam = params?.id

  if (typeof locationParam !== 'string' || typeof gameIdParam !== 'string') {
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

  try {
    const game = await fetchGame(locationParam, gameIdParam)

    if (!game || !game._id) {
      return { notFound: true }
    }

    const serializedGame = JSON.parse(JSON.stringify(game))
    const status = serializedGame.status || 'active'
    const isGameStarted = status === 'started'
    const isGameFinished = status === 'finished'

    const db = await dbConnect(locationParam)

    if (!db) {
      return {
        props: {
          session,
          location: locationParam,
          game: serializedGame,
          participantTeams: [],
          isParticipant: false,
          isGameStarted,
          isGameFinished,
          status,
          error: 'DB_CONNECTION_FAILED',
        },
      }
    }

    const gamesTeams = await db
      .model('GamesTeams')
      .find({ gameId: gameIdParam })
      .lean()

    const teamIds = Array.isArray(gamesTeams)
      ? gamesTeams.map((gameTeam) => gameTeam?.teamId).filter(Boolean)
      : []

    let isParticipant = false
    let participantTeams = []

    if (teamIds.length > 0 && session?.user?.telegramId) {
      const teamsUsers = await db
        .model('TeamsUsers')
        .find({ teamId: { $in: teamIds } })
        .lean()

      const telegramId = String(session.user.telegramId)

      const memberships = teamsUsers.filter(
        (item) => String(item.userTelegramId) === telegramId
      )

      if (memberships.length > 0) {
        isParticipant = true
        const membershipTeamIds = [
          ...new Set(
            memberships
              .map((item) => item.teamId)
              .filter(Boolean)
              .map((value) => String(value))
          ),
        ]

        const teams = await db
          .model('Teams')
          .find({ _id: { $in: membershipTeamIds } })
          .lean()

        participantTeams = teams
          .map((team) => {
            const id = String(team._id)
            const mappedTeam = gamesTeams.find(
              (gameTeam) => String(gameTeam.teamId) === id
            )

            if (!mappedTeam) return null

            return {
              id,
              name: team.name || 'Команда без названия',
            }
          })
          .filter(Boolean)
      }
    }

    return {
      props: {
        session,
        location: locationParam,
        game: serializedGame,
        participantTeams: JSON.parse(JSON.stringify(participantTeams)),
        isParticipant,
        isGameStarted,
        isGameFinished,
        status,
        error: null,
      },
    }
  } catch (error) {
    console.error('Game entry page error', error)
    return {
      props: {
        session,
        location: locationParam,
        game: null,
        participantTeams: [],
        isParticipant: false,
        isGameStarted: false,
        isGameFinished: false,
        status: 'active',
        error: 'UNKNOWN_ERROR',
      },
    }
  }
}
