import Head from 'next/head'
import PropTypes from 'prop-types'
import { useCallback, useMemo } from 'react'
import { useSession } from 'next-auth/react'

import CabinetLayout from '@components/cabinet/CabinetLayout'
import getSessionSafe from '@helpers/getSessionSafe'
import { resolveCabinetCallback } from '@helpers/cabinetAuth'
import formatRelativeTimeFromNow from '@helpers/formatRelativeTimeFromNow'
import getGameStatusLabel from '@helpers/getGameStatusLabel'
import { getNounTeams, getNounUsers } from '@helpers/getNoun'
import dbConnect from '@utils/dbConnect'

const quickActions = [
  {
    id: 'create-game',
    title: 'Создать новую игру',
    description:
      'Заполните сценарий, настройте расписание и пригласите команды в несколько шагов.',
    href: '/cabinet/games',
  },
  {
    id: 'invite-team',
    title: 'Пригласить команду',
    description:
      'Отправьте ссылку на участие, назначьте капитана и управляйте составом.',
    href: '/cabinet/teams',
  },
  {
    id: 'update-profile',
    title: 'Обновить профиль',
    description:
      'Укажите актуальные контакты и роль в проекте, чтобы коллеги могли вас найти.',
    href: '/cabinet/profile',
  },
]

const CabinetDashboard = ({
  session: initialSession,
  stats: initialStats,
  activity: initialActivity,
}) => {
  const { data: session, status } = useSession()
  const activeSession = session ?? initialSession ?? null

  const numberFormatter = useMemo(() => new Intl.NumberFormat('ru-RU'), [])
  const stats = initialStats ?? { activeGames: 0, teams: 0, players: 0 }

  const normalizedStats = useMemo(
    () => [
      {
        id: 'games',
        title: 'Активные игры',
        value: numberFormatter.format(stats.activeGames ?? 0),
        description: 'Статусы «активна» и «запущена» по выбранному городу.',
      },
      {
        id: 'teams',
        title: 'Команд участвует',
        value: numberFormatter.format(stats.teams ?? 0),
        description: 'Всего зарегистрированных команд.',
      },
      {
        id: 'players',
        title: 'Игроков задействовано',
        value: numberFormatter.format(stats.players ?? 0),
        description: 'Количество участников, привязанных к командам.',
      },
    ],
    [numberFormatter, stats]
  )

  const buildGameDetails = useCallback((item) => {
    const parts = []

    if (item.status) {
      parts.push(`Статус: ${getGameStatusLabel(item.status)}`)
    }

    if (typeof item.teamsCount === 'number' && item.teamsCount >= 0) {
      parts.push(getNounTeams(item.teamsCount))
    }

    if (item.hidden) {
      parts.push('Скрыта из списка')
    }

    return parts.length > 0 ? parts.join(' · ') : 'Изменение параметров игры'
  }, [])

  const buildTeamDetails = useCallback((item) => {
    const parts = []

    if (typeof item.membersCount === 'number' && item.membersCount >= 0) {
      parts.push(getNounUsers(item.membersCount))
    }

    return parts.length > 0 ? parts.join(' · ') : 'Обновление карточки команды'
  }, [])

  const activityItems = useMemo(() => {
    if (!Array.isArray(initialActivity)) {
      return []
    }

    return initialActivity.map((item) => {
      const timestamp = item.timestamp ?? null
      const relativeTime = timestamp
        ? formatRelativeTimeFromNow(timestamp)
        : '—'
      const absoluteTime = timestamp
        ? new Date(timestamp).toLocaleString('ru-RU')
        : undefined

      const isGame = item.type === 'game'
      const title = isGame
        ? `Игра «${item.name || 'Без названия'}» обновлена`
        : `Команда «${item.name || 'Без названия'}» обновлена`

      const details = isGame ? buildGameDetails(item) : buildTeamDetails(item)

      return {
        id: item.id,
        title,
        category: isGame ? 'Игры' : 'Команды',
        relativeTime,
        absoluteTime,
        details,
      }
    })
  }, [buildGameDetails, buildTeamDetails, initialActivity])

  if (!activeSession) {
    if (status === 'loading') {
      return (
        <div className="flex items-center justify-center min-h-screen bg-slate-900 text-white">
          <span className="text-sm font-semibold tracking-widest uppercase">Загрузка кабинета…</span>
        </div>
      )
    }

    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900 text-white">
        <div className="space-y-4 text-center">
          <Head>
            <title>ActQuest — Кабинет</title>
          </Head>
          <p className="text-lg font-semibold">Сессия не найдена</p>
          <p className="text-sm text-slate-200">
            Похоже, вы не авторизованы. Пожалуйста, перейдите на страницу входа и попробуйте снова.
          </p>
          <a
            href="/cabinet/login"
          className="inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-slate-900 bg-white rounded-xl"
        >
            Перейти к авторизации
          </a>
        </div>
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>ActQuest — Кабинет</title>
      </Head>
      <CabinetLayout
        title="Обзор"
        description="Следите за активными играми, командами и ключевыми событиями вашего города."
        activePage="dashboard"
      >
        <section className="grid gap-4 md:grid-cols-3">
          {normalizedStats.map((stat) => (
            <article
              key={stat.id}
              className="p-5 transition-shadow bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md dark:bg-slate-900/80 dark:border-slate-700 dark:hover:shadow-lg"
            >
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{stat.title}</p>
              <p className="mt-3 text-3xl font-semibold text-primary dark:text-slate-100">{stat.value}</p>
              <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">{stat.description}</p>
            </article>
          ))}
        </section>

        <section className="grid gap-6 md:grid-cols-5">
          <div className="md:col-span-3 p-6 bg-white border border-slate-200 rounded-2xl shadow-sm dark:bg-slate-900/80 dark:border-slate-700">
            <h3 className="text-lg font-semibold text-primary dark:text-slate-100">Быстрые действия</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Сосредоточьтесь на задачах — переходите к нужным разделам без лишних шагов.
            </p>
            <div className="mt-4 space-y-4">
              {quickActions.map((action) => (
                <a
                  key={action.id}
                  href={action.href}
                  className="block p-4 transition bg-slate-50 rounded-xl hover:bg-blue-50 dark:bg-slate-800 dark:hover:bg-blue-500/10"
                >
                  <p className="text-sm font-semibold text-primary dark:text-slate-100">{action.title}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{action.description}</p>
                </a>
              ))}
            </div>
          </div>

          <div className="md:col-span-2 p-6 bg-white border border-slate-200 rounded-2xl shadow-sm dark:bg-slate-900/80 dark:border-slate-700">
            <h3 className="text-lg font-semibold text-primary dark:text-slate-100">Лента активности</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Последние изменения, которые произошли в вашем кабинете.
            </p>
            <ul className="mt-4 space-y-4">
              {activityItems.length > 0 ? (
                activityItems.map((item) => (
                  <li key={item.id} className="p-4 bg-slate-50 rounded-xl dark:bg-slate-800">
                    <p className="text-sm font-semibold text-primary dark:text-slate-100">{item.title}</p>
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{item.details}</p>
                    <div className="flex items-center justify-between mt-3 text-xs text-slate-500 dark:text-slate-400">
                      <span>{item.category}</span>
                      <span title={item.absoluteTime}>{item.relativeTime}</span>
                    </div>
                  </li>
                ))
              ) : (
                <li className="p-4 bg-slate-50 rounded-xl dark:bg-slate-800">
                  <p className="text-sm text-slate-500 dark:text-slate-400">Недавняя активность не найдена.</p>
                </li>
              )}
            </ul>
          </div>
        </section>

        <section className="p-6 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-3xl text-white shadow-md">
          <h3 className="text-xl font-semibold">Запланируйте следующую игру</h3>
          <p className="mt-2 text-sm text-blue-100">
            Создавайте сценарии заранее, чтобы вовремя запустить квест и подготовить команды к старту.
          </p>
          <div className="flex flex-col gap-3 mt-6 md:flex-row">
            <a
              href="/cabinet/games"
              className="inline-flex items-center justify-center px-5 py-3 text-sm font-semibold text-blue-700 bg-white rounded-xl shadow-sm"
            >
              Перейти к списку игр
            </a>
            <a
              href="/cabinet/admin"
              className="inline-flex items-center justify-center px-5 py-3 text-sm font-semibold text-white border border-white/40 rounded-xl hover:bg-white/10"
            >
              Управление доступами
            </a>
          </div>
        </section>
      </CabinetLayout>
    </>
  )
}

CabinetDashboard.propTypes = {
  session: PropTypes.object,
  stats: PropTypes.shape({
    activeGames: PropTypes.number,
    teams: PropTypes.number,
    players: PropTypes.number,
  }),
  activity: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      type: PropTypes.string,
      name: PropTypes.string,
      status: PropTypes.string,
      hidden: PropTypes.bool,
      teamsCount: PropTypes.number,
      membersCount: PropTypes.number,
      timestamp: PropTypes.string,
    })
  ),
}

CabinetDashboard.defaultProps = {
  session: null,
  stats: { activeGames: 0, teams: 0, players: 0 },
  activity: [],
}

export async function getServerSideProps(context) {
  const session = await getSessionSafe(context)
  const { relativeCallback, isSafe } = resolveCabinetCallback(context?.query?.callbackUrl, context?.req)

  if (!session) {
    const target = isSafe ? relativeCallback : null
    const query = target ? `?callbackUrl=${encodeURIComponent(target)}` : ''

    return {
      redirect: {
        destination: `/cabinet/login${query}`,
        permanent: false,
      },
    }
  }

  if (isSafe && relativeCallback) {
    return {
      redirect: {
        destination: '/',
        permanent: false,
      },
    }
  }

  const location = session?.user?.location ?? null
  let stats = { activeGames: 0, teams: 0, players: 0 }
  let activity = []

  if (location) {
    try {
      const db = await dbConnect(location)

      if (db) {
        const GamesModel = db.model('Games')
        const TeamsModel = db.model('Teams')
        const TeamsUsersModel = db.model('TeamsUsers')
        const GamesTeamsModel = db.model('GamesTeams')

        const [activeGamesCount, totalTeamsCount, totalPlayersCount, recentGames, recentTeams] =
          await Promise.all([
            GamesModel.countDocuments({ status: { $in: ['active', 'started'] } }),
            TeamsModel.countDocuments({}),
            TeamsUsersModel.countDocuments({}),
            GamesModel.find({})
              .sort({ updatedAt: -1 })
              .limit(5)
              .select({
                _id: 1,
                name: 1,
                status: 1,
                hidden: 1,
                updatedAt: 1,
                createdAt: 1,
              })
              .lean(),
            TeamsModel.find({})
              .sort({ updatedAt: -1 })
              .limit(5)
              .select({ _id: 1, name: 1, updatedAt: 1, createdAt: 1 })
              .lean(),
          ])

        stats = {
          activeGames: activeGamesCount,
          teams: totalTeamsCount,
          players: totalPlayersCount,
        }

        const gameIds = recentGames
          .map((game) => (game?._id ? game._id.toString() : null))
          .filter(Boolean)

        let teamsCountMap = {}

        if (gameIds.length > 0) {
          const gamesTeams = await GamesTeamsModel.find({ gameId: { $in: gameIds } })
            .select({ gameId: 1 })
            .lean()

          teamsCountMap = gamesTeams.reduce((acc, doc) => {
            if (!doc?.gameId) {
              return acc
            }

            const key = doc.gameId
            acc[key] = (acc[key] ?? 0) + 1
            return acc
          }, {})
        }

        const teamIds = recentTeams
          .map((team) => (team?._id ? team._id.toString() : null))
          .filter(Boolean)

        let membersCountMap = {}

        if (teamIds.length > 0) {
          const teamMembers = await TeamsUsersModel.find({ teamId: { $in: teamIds } })
            .select({ teamId: 1 })
            .lean()

          membersCountMap = teamMembers.reduce((acc, doc) => {
            if (!doc?.teamId) {
              return acc
            }

            const key = doc.teamId
            acc[key] = (acc[key] ?? 0) + 1
            return acc
          }, {})
        }

        const gamesActivity = recentGames.map((game) => {
          const idString = game?._id ? game._id.toString() : null
          const timestamp = game?.updatedAt ?? game?.createdAt ?? null

          return {
            id: `game-${idString ?? Math.random().toString(36).slice(2)}`,
            type: 'game',
            name: game?.name ?? 'Без названия',
            status: game?.status ?? null,
            hidden: Boolean(game?.hidden),
            teamsCount: idString ? teamsCountMap[idString] ?? 0 : 0,
            timestamp: timestamp ? new Date(timestamp).toISOString() : null,
          }
        })

        const teamsActivity = recentTeams.map((team) => {
          const idString = team?._id ? team._id.toString() : null
          const timestamp = team?.updatedAt ?? team?.createdAt ?? null

          return {
            id: `team-${idString ?? Math.random().toString(36).slice(2)}`,
            type: 'team',
            name: team?.name ?? 'Без названия',
            membersCount: idString ? membersCountMap[idString] ?? 0 : 0,
            timestamp: timestamp ? new Date(timestamp).toISOString() : null,
          }
        })

        activity = [...gamesActivity, ...teamsActivity]
          .filter((item) => item.timestamp)
          .sort(
            (a, b) =>
              new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          )
          .slice(0, 8)
      }
    } catch (error) {
      console.error('Failed to load cabinet dashboard data', error)
    }
  }

  return {
    props: {
      session,
      stats,
      activity,
    },
  }
}

export default CabinetDashboard
