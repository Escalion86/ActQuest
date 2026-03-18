import Head from 'next/head'
import PropTypes from 'prop-types'
import { useMemo } from 'react'
import { useSession } from 'next-auth/react'

import CabinetLayout from '@components/cabinet/CabinetLayout'
import getSessionSafe from '@helpers/getSessionSafe'
import { resolveCabinetCallback } from '@helpers/cabinetAuth'
import formatRelativeTimeFromNow from '@helpers/formatRelativeTimeFromNow'
import getGameStatusLabel from '@helpers/getGameStatusLabel'
import normalizeSiteSettings from '@helpers/normalizeSiteSettings'
import useCabinetRolePreview from '@helpers/useCabinetRolePreview'
import dbConnectGlobal from '@utils/dbConnectGlobal'
import { LOCATIONS } from '@server/serverConstants'

const toStringId = (value) => {
  if (value === null || value === undefined) {
    return null
  }

  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }

  if (typeof value.toString === 'function') {
    const stringValue = value.toString()
    return stringValue && stringValue !== '[object Object]' ? stringValue : null
  }

  return null
}

const normalizeLocationName = (locationKey) => {
  const location = locationKey ? LOCATIONS[locationKey] : null
  const rawName = location?.townRu ?? ''

  if (!rawName) {
    return 'Город не выбран'
  }

  return rawName.charAt(0).toUpperCase() + rawName.slice(1)
}

const resolveUserFilter = (sessionUser) => {
  const globalUserId = sessionUser?.globalUserId || sessionUser?._id || null
  if (globalUserId) return { _id: globalUserId }

  if (sessionUser?.phone) return { phone: Number(sessionUser.phone) }
  if (sessionUser?.telegramId) return { telegramId: Number(sessionUser.telegramId) }
  if (sessionUser?.vkId) return { vkId: Number(sessionUser.vkId) }

  return null
}

const isUpcomingGame = (game, nowDate) => {
  const status = (game?.status ?? '').toString().toLowerCase()
  if (status === 'finished' || status === 'canceled') {
    return false
  }

  const startDate = game?.dateStart ? new Date(game.dateStart) : null
  if (startDate && !Number.isNaN(startDate.getTime())) {
    return startDate >= nowDate
  }

  return status === 'active' || status === 'started'
}

const isPastGame = (game, nowDate) => {
  const status = (game?.status ?? '').toString().toLowerCase()
  if (status === 'finished' || status === 'canceled') {
    return true
  }

  const startDate = game?.dateStart ? new Date(game.dateStart) : null
  if (startDate && !Number.isNaN(startDate.getTime())) {
    return startDate < nowDate
  }

  return false
}

const resolveTeamsPlace = (teamsPlaces, teamId) => {
  if (!teamsPlaces || !teamId) {
    return null
  }

  if (typeof teamsPlaces.get === 'function') {
    const mapValue = teamsPlaces.get(teamId)
    return Number.isFinite(Number(mapValue)) ? Number(mapValue) : null
  }

  const objectValue = teamsPlaces[teamId]
  return Number.isFinite(Number(objectValue)) ? Number(objectValue) : null
}

const resolveUserTeamIdFromResult = (gameResult, userId, telegramId) => {
  const teamsUsers = Array.isArray(gameResult?.teamsUsers) ? gameResult.teamsUsers : []
  if (!teamsUsers.length) {
    return null
  }

  const membership = teamsUsers.find((item) => {
    const itemUserId = toStringId(item?.userId)
    const itemTelegramId = Number(item?.userTelegramId)
    if (userId && itemUserId && itemUserId === userId) {
      return true
    }
    if (Number.isFinite(telegramId) && Number.isFinite(itemTelegramId)) {
      return itemTelegramId === telegramId
    }
    return false
  })

  return toStringId(membership?.teamId)
}

const quickActionsBase = [
  {
    id: 'upcoming-games',
    title: 'Предстоящие игры',
    description: 'Найдите ближайшие события и откройте карточку игры.',
    href: '/cabinet/games?view=upcoming',
  },
  {
    id: 'teams',
    title: 'Мои команды',
    description: 'Проверьте состав, роль капитана и активность участников.',
    href: '/cabinet/teams',
  },
  {
    id: 'profile',
    title: 'Мой профиль',
    description: 'Обновите контакты и личную информацию.',
    href: '/cabinet/profile',
  },
]

const CabinetDashboard = ({
  session: initialSession,
  dashboardData: initialDashboardData,
}) => {
  const { data: session, status } = useSession()
  const activeSession = session ?? initialSession ?? null
  const { effectiveRole } = useCabinetRolePreview(activeSession?.user?.role ?? 'client')
  const isAdmin = effectiveRole === 'admin' || effectiveRole === 'dev'

  const dashboardData = initialDashboardData ?? {
    cityName: 'Город не выбран',
    teamsCount: 0,
    upcomingGamesCount: 0,
    pastGamesCount: 0,
    hasTeam: false,
    hasUpcomingRegistration: false,
    profileCompleted: false,
    nearestGame: null,
    personalProgressGames: [],
    recentActivity: [],
    chatUrl: '',
  }

  const quickActions = useMemo(() => {
    if (!isAdmin) {
      return quickActionsBase
    }

    return [
      ...quickActionsBase,
      {
        id: 'admin',
        title: 'Администрирование',
        description: 'Управление пользователями, командами, отчётами и транзакциями.',
        href: '/cabinet/admin',
      },
    ]
  }, [isAdmin])

  if (!activeSession) {
    if (status === 'loading') {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-900 text-white">
          <span className="text-sm font-semibold uppercase tracking-widest">Загрузка кабинета…</span>
        </div>
      )
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 text-white">
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
            className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 dark:bg-slate-900/80 dark:text-slate-100"
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
        <title>ActQuest — Обзор</title>
      </Head>
      <CabinetLayout
        title="Обзор"
        description="Ваш личный статус, ближайшие игры и быстрый доступ к ключевым действиям."
        activePage="dashboard"
      >
        <section className="grid gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Команды</p>
            <p className="mt-2 text-3xl font-semibold text-primary dark:text-slate-100">{dashboardData.teamsCount}</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Предстоящие игры</p>
            <p className="mt-2 text-3xl font-semibold text-primary dark:text-slate-100">{dashboardData.upcomingGamesCount}</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Прошедшие игры</p>
            <p className="mt-2 text-3xl font-semibold text-primary dark:text-slate-100">{dashboardData.pastGamesCount}</p>
          </article>
        </section>

        <section className="grid gap-6 md:grid-cols-5">
          <div className="space-y-6 md:col-span-3">
            <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
              <h3 className="aq-modal-section-title text-base font-semibold">Личный прогресс</h3>
              {dashboardData.personalProgressGames.length > 0 ? (
                <ul className="mt-4 space-y-3">
                  {dashboardData.personalProgressGames.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-800/80"
                    >
                      <div className="min-w-0">
                        <p className="aq-modal-item-title truncate text-sm font-semibold">{item.gameName}</p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">{item.dateLabel}</p>
                      </div>
                      <span className="inline-flex shrink-0 items-center rounded-full border border-cyan-300 bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-700 dark:border-cyan-500/40 dark:bg-cyan-500/10 dark:text-cyan-200">
                        {item.place ? `${item.place} место` : 'Без места'}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm text-slate-500 dark:text-slate-300">
                  Завершённых игр с итоговым местом пока нет.
                </p>
              )}
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
              <h3 className="aq-modal-section-title text-base font-semibold">Быстрые действия</h3>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {quickActions.map((action) => (
                  <a
                    key={action.id}
                    href={action.href}
                    className="block rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-800/80 dark:hover:bg-blue-500/10"
                  >
                    <p className="aq-modal-item-title text-sm font-semibold">{action.title}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">{action.description}</p>
                  </a>
                ))}
              </div>
            </article>
          </div>

          <div className="space-y-6 md:col-span-2">
            <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
              <h3 className="aq-modal-section-title text-base font-semibold">Ближайшая игра</h3>
              {dashboardData.nearestGame ? (
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/80">
                  <p className="aq-modal-item-title text-sm font-semibold">
                    {dashboardData.nearestGame.name || 'Без названия'}
                  </p>
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-300">
                    {dashboardData.nearestGame.dateStart
                      ? new Date(dashboardData.nearestGame.dateStart).toLocaleString('ru-RU')
                      : 'Дата старта уточняется'}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">
                    Статус: {getGameStatusLabel(dashboardData.nearestGame.status)}
                  </p>
                  <a
                    href="/cabinet/games?view=upcoming"
                    className="mt-4 inline-flex cursor-pointer items-center justify-center rounded-lg border border-primary px-3 py-2 text-xs font-semibold text-primary transition hover:bg-blue-50 dark:hover:bg-sky-500/10"
                  >
                    Открыть список игр
                  </a>
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-500 dark:text-slate-300">
                  Пока нет зарегистрированных предстоящих игр. Выберите игру и присоединитесь к старту.
                </p>
              )}
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
              <h3 className="aq-modal-section-title text-base font-semibold">Последние события</h3>
              {dashboardData.recentActivity.length > 0 ? (
                <ul className="mt-4 space-y-3">
                  {dashboardData.recentActivity.map((item) => (
                    <li
                      key={item.id}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-800/80"
                    >
                      <p className="aq-modal-item-title text-sm font-semibold">{item.title}</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">{item.details}</p>
                      <p className="mt-2 text-xs text-slate-400">{formatRelativeTimeFromNow(item.timestamp)}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm text-slate-500 dark:text-slate-300">
                  Событий пока нет. Как только появится активность, она отобразится здесь.
                </p>
              )}
            </article>

            {dashboardData.chatUrl ? (
              <article className="rounded-2xl border border-cyan-300 bg-cyan-50 p-5 shadow-sm dark:border-cyan-500/30 dark:bg-cyan-500/10">
                <h3 className="aq-modal-section-title text-base font-semibold">Чат проекта</h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-200">
                  Вопросы, анонсы и быстрые ответы команды ActQuest.
                </p>
                <a
                  href={dashboardData.chatUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex cursor-pointer items-center justify-center rounded-lg border border-cyan-400 px-3 py-2 text-xs font-semibold text-cyan-700 transition hover:bg-cyan-100 dark:border-cyan-300/50 dark:text-cyan-100 dark:hover:bg-cyan-500/15"
                >
                  Перейти в чат
                </a>
              </article>
            ) : null}
          </div>
        </section>
      </CabinetLayout>
    </>
  )
}

CabinetDashboard.propTypes = {
  session: PropTypes.object,
  dashboardData: PropTypes.shape({
    cityName: PropTypes.string,
    teamsCount: PropTypes.number,
    upcomingGamesCount: PropTypes.number,
    pastGamesCount: PropTypes.number,
    hasTeam: PropTypes.bool,
    hasUpcomingRegistration: PropTypes.bool,
    profileCompleted: PropTypes.bool,
    nearestGame: PropTypes.shape({
      id: PropTypes.string,
      name: PropTypes.string,
      status: PropTypes.string,
      dateStart: PropTypes.string,
    }),
    personalProgressGames: PropTypes.arrayOf(
      PropTypes.shape({
        id: PropTypes.string.isRequired,
        gameName: PropTypes.string.isRequired,
        dateLabel: PropTypes.string.isRequired,
        place: PropTypes.number,
      })
    ),
    recentActivity: PropTypes.arrayOf(
      PropTypes.shape({
        id: PropTypes.string.isRequired,
        title: PropTypes.string.isRequired,
        details: PropTypes.string.isRequired,
        timestamp: PropTypes.string.isRequired,
      })
    ),
    chatUrl: PropTypes.string,
  }),
}

CabinetDashboard.defaultProps = {
  session: null,
  dashboardData: {
    cityName: 'Город не выбран',
    teamsCount: 0,
    upcomingGamesCount: 0,
    pastGamesCount: 0,
    hasTeam: false,
    hasUpcomingRegistration: false,
    profileCompleted: false,
    nearestGame: null,
    personalProgressGames: [],
    recentActivity: [],
    chatUrl: '',
  },
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

  if (
    isSafe &&
    relativeCallback &&
    relativeCallback !== '/cabinet' &&
    relativeCallback !== '/cabinet/'
  ) {
    return {
      redirect: {
        destination: relativeCallback,
        permanent: false,
      },
    }
  }

  const location = session?.user?.location ?? null
  const cityName = normalizeLocationName(location)
  const userRole = session?.user?.role ?? 'client'
  const canViewHiddenGames = userRole === 'admin' || userRole === 'dev' || userRole === 'moder'

  const dashboardData = {
    cityName,
    teamsCount: 0,
    upcomingGamesCount: 0,
    pastGamesCount: 0,
    hasTeam: false,
    hasUpcomingRegistration: false,
    profileCompleted: false,
    nearestGame: null,
    personalProgressGames: [],
    recentActivity: [],
    chatUrl: '',
  }

  try {
    const db = await dbConnectGlobal()
    if (!db) {
      return { props: { session, dashboardData } }
    }

    const UsersModel = db.model('Users')
    const TeamsUsersModel = db.model('TeamsUsers')
    const TeamsModel = db.model('Teams')
    const GamesTeamsModel = db.model('GamesTeams')
    const GamesModel = db.model('Games')
    const SiteSettingsModel = db.model('SiteSettings')

    const userFilter = resolveUserFilter(session.user)
    const sessionUserId = toStringId(session?.user?.globalUserId || session?.user?._id)
    const sessionTelegramId =
      session?.user?.telegramId === null || session?.user?.telegramId === undefined
        ? null
        : Number(session.user.telegramId)

    const [userDoc, siteSettingsDoc] = await Promise.all([
      userFilter
        ? UsersModel.findOne(userFilter)
            .select({ _id: 1, name: 1, about: 1, phone: 1 })
            .lean()
        : null,
      SiteSettingsModel.findOne({}).lean(),
    ])

    const userId = toStringId(userDoc?._id) || sessionUserId
    const membershipOr = []
    if (userId) {
      membershipOr.push({ userId })
    }
    if (Number.isFinite(sessionTelegramId)) {
      membershipOr.push({ userTelegramId: sessionTelegramId })
    }

    const memberships = membershipOr.length
      ? await TeamsUsersModel.find({ $or: membershipOr })
          .select({ teamId: 1, role: 1, updatedAt: 1, createdAt: 1 })
          .lean()
      : []

    const teamIds = Array.from(
      new Set(
        memberships
          .map((membership) => toStringId(membership?.teamId))
          .filter((teamId) => typeof teamId === 'string' && teamId.length > 0)
      )
    )

    const [teamsDocs, gamesTeamsDocs, teamMembersDocs] = await Promise.all([
      teamIds.length
        ? TeamsModel.find({ _id: { $in: teamIds } })
            .select({ _id: 1, name: 1, updatedAt: 1, createdAt: 1 })
            .lean()
        : [],
      teamIds.length
        ? GamesTeamsModel.find({ teamId: { $in: teamIds } })
            .select({ gameId: 1, teamId: 1 })
            .lean()
        : [],
      teamIds.length
        ? TeamsUsersModel.find({ teamId: { $in: teamIds } })
            .select({ teamId: 1 })
            .lean()
        : [],
    ])

    const gameIds = Array.from(
      new Set(
        gamesTeamsDocs
          .map((link) => toStringId(link?.gameId))
          .filter((gameId) => typeof gameId === 'string' && gameId.length > 0)
      )
    )

    const gamesQuery = { _id: { $in: gameIds } }
    if (!canViewHiddenGames) {
      gamesQuery.hidden = { $ne: true }
    }

    const gamesDocs = gameIds.length
      ? await GamesModel.find(gamesQuery)
          .select({
            _id: 1,
            name: 1,
            status: 1,
            dateStart: 1,
            hidden: 1,
            updatedAt: 1,
            createdAt: 1,
            'result.teamsPlaces': 1,
            'result.teamsUsers': 1,
          })
          .lean()
      : []

    const now = new Date()
    const upcomingGames = gamesDocs.filter((game) => isUpcomingGame(game, now))
    const pastGames = gamesDocs.filter((game) => isPastGame(game, now))
    const nearestGame = [...upcomingGames]
      .sort((a, b) => {
        const aTime = a?.dateStart ? new Date(a.dateStart).getTime() : Number.POSITIVE_INFINITY
        const bTime = b?.dateStart ? new Date(b.dateStart).getTime() : Number.POSITIVE_INFINITY
        return aTime - bTime
      })[0]

    const membersCountMap = teamMembersDocs.reduce((acc, doc) => {
      const teamId = toStringId(doc?.teamId)
      if (!teamId) return acc
      acc[teamId] = (acc[teamId] ?? 0) + 1
      return acc
    }, {})

    const teamActivity = teamsDocs.map((team) => {
      const teamId = toStringId(team?._id)
      const timestamp = team?.updatedAt ?? team?.createdAt ?? null
      return {
        id: `team-${teamId ?? Math.random().toString(36).slice(2)}`,
        title: `Команда «${team?.name || 'Без названия'}»`,
        details: `Участников: ${membersCountMap[teamId] ?? 0}`,
        timestamp: timestamp ? new Date(timestamp).toISOString() : null,
      }
    })

    const gameActivity = gamesDocs.map((game) => {
      const gameId = toStringId(game?._id)
      const timestamp = game?.updatedAt ?? game?.createdAt ?? null
      return {
        id: `game-${gameId ?? Math.random().toString(36).slice(2)}`,
        title: `Игра «${game?.name || 'Без названия'}»`,
        details: `Статус: ${getGameStatusLabel(game?.status)}`,
        timestamp: timestamp ? new Date(timestamp).toISOString() : null,
      }
    })

    const recentActivity = [...gameActivity, ...teamActivity]
      .filter((item) => item.timestamp)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 6)

    const gameTeamIdsByGameId = gamesTeamsDocs.reduce((acc, link) => {
      const gameId = toStringId(link?.gameId)
      const teamId = toStringId(link?.teamId)
      if (!gameId || !teamId) {
        return acc
      }
      if (!acc[gameId]) {
        acc[gameId] = new Set()
      }
      acc[gameId].add(teamId)
      return acc
    }, {})

    const personalProgressGames = [...pastGames]
      .filter((game) => (game?.status ?? '').toString().toLowerCase() === 'finished')
      .map((game) => {
        const gameId = toStringId(game?._id)
        const teamIdFromResult = resolveUserTeamIdFromResult(game?.result, userId, sessionTelegramId)
        const teamIdFromLinks =
          gameId && gameTeamIdsByGameId[gameId] ? [...gameTeamIdsByGameId[gameId]][0] : null
        const resolvedTeamId = teamIdFromResult || teamIdFromLinks
        const place = resolveTeamsPlace(game?.result?.teamsPlaces, resolvedTeamId)
        const gameDate = game?.dateStart ? new Date(game.dateStart) : null
        const timestamp =
          gameDate && !Number.isNaN(gameDate.getTime()) ? gameDate.getTime() : 0
        return {
          id: gameId || `progress-${Math.random().toString(36).slice(2)}`,
          gameName: game?.name || 'Без названия',
          dateLabel:
            gameDate && !Number.isNaN(gameDate.getTime())
              ? gameDate.toLocaleString('ru-RU')
              : 'Дата не указана',
          place,
          timestamp,
        }
      })
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 12)
      .map(({ timestamp, ...item }) => item)

    const normalizedSiteSettings = normalizeSiteSettings(siteSettingsDoc)
    const hasProfileName = typeof userDoc?.name === 'string' && userDoc.name.trim().length > 0
    const hasProfileAbout = typeof userDoc?.about === 'string' && userDoc.about.trim().length > 0
    const hasProfilePhone = Boolean(userDoc?.phone)

    dashboardData.teamsCount = teamIds.length
    dashboardData.upcomingGamesCount = upcomingGames.length
    dashboardData.pastGamesCount = pastGames.length
    dashboardData.hasTeam = teamIds.length > 0
    dashboardData.hasUpcomingRegistration = upcomingGames.length > 0
    dashboardData.profileCompleted = hasProfileName && (hasProfileAbout || hasProfilePhone)
    dashboardData.nearestGame = nearestGame
      ? {
          id: toStringId(nearestGame._id),
          name: nearestGame.name ?? 'Без названия',
          status: nearestGame.status ?? '',
          dateStart: nearestGame.dateStart
            ? new Date(nearestGame.dateStart).toISOString()
            : null,
        }
      : null
    dashboardData.personalProgressGames = personalProgressGames
    dashboardData.recentActivity = recentActivity
    dashboardData.chatUrl = normalizedSiteSettings.chatUrl || ''
  } catch (error) {
    console.error('Failed to load client dashboard data', error)
  }

  return {
    props: {
      session,
      dashboardData,
    },
  }
}

export default CabinetDashboard
