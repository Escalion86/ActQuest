import { useMemo } from 'react'
import PropTypes from 'prop-types'
import Head from 'next/head'
import { useSession } from 'next-auth/react'

import CabinetLayout from '@components/cabinet/CabinetLayout'
import formatRelativeTimeFromNow from '@helpers/formatRelativeTimeFromNow'
import getSessionSafe from '@helpers/getSessionSafe'
import isUserAdmin from '@helpers/isUserAdmin'
import dbConnect from '@utils/dbConnect'

const roleLabels = {
  client: 'Пользователь',
  moder: 'Модератор',
  admin: 'Администратор',
  dev: 'Разработчик',
  ban: 'Заблокирован',
}

const toStringId = (value) => {
  if (!value && value !== 0) {
    return null
  }

  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'number') {
    return value.toString()
  }

  if (value && typeof value.toString === 'function') {
    const stringValue = value.toString()
    return stringValue === '[object Object]' ? null : stringValue
  }

  return null
}

const ensureDateISOString = (value) => {
  if (!value) {
    return null
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return null
  }

  return date.toISOString()
}

const createEmptyReports = () => ({
  summary: {
    totalUsers: 0,
    newUsersWeek: 0,
    activeUsersMonth: 0,
    totalTeams: 0,
    openTeams: 0,
    closedTeams: 0,
    memberships: 0,
    uniqueParticipants: 0,
    totalGames: 0,
    activeGames: 0,
    finishedGames: 0,
    canceledGames: 0,
    gamesLast30: 0,
  },
  roles: [],
  topTeams: [],
  recentActivity: [],
})

const ReportsPage = ({ initialReports, initialLocation, session: initialSession }) => {
  const { data: session } = useSession()
  const activeSession = session ?? initialSession ?? null
  const isAdmin = isUserAdmin({ role: activeSession?.user?.role })

  const numberFormatter = useMemo(() => new Intl.NumberFormat('ru-RU'), [])
  const summarySections = useMemo(() => {
    const summary = initialReports.summary

    return [
      {
        id: 'users',
        title: 'Пользователи',
        items: [
          { label: 'Всего пользователей', value: summary.totalUsers },
          { label: 'Новые за 7 дней', value: summary.newUsersWeek },
          { label: 'Активны за 30 дней', value: summary.activeUsersMonth },
        ],
      },
      {
        id: 'teams',
        title: 'Команды',
        items: [
          { label: 'Всего команд', value: summary.totalTeams },
          { label: 'Открытые команды', value: summary.openTeams },
          { label: 'Закрытые команды', value: summary.closedTeams },
          { label: 'Участий в командах', value: summary.memberships },
          { label: 'Уникальных участников', value: summary.uniqueParticipants },
        ],
      },
      {
        id: 'games',
        title: 'Игры',
        items: [
          { label: 'Всего игр', value: summary.totalGames },
          { label: 'Активные игры', value: summary.activeGames },
          { label: 'Завершённые игры', value: summary.finishedGames },
          { label: 'Отменённые игры', value: summary.canceledGames },
          { label: 'Обновлены за 30 дней', value: summary.gamesLast30 },
        ],
      },
    ]
  }, [initialReports.summary])

  const rolesTotal = useMemo(
    () => initialReports.roles.reduce((acc, role) => acc + role.count, 0),
    [initialReports.roles]
  )

  if (!isAdmin) {
    return (
      <>
        <Head>
          <title>ActQuest — Статистика и отчёты</title>
        </Head>
        <CabinetLayout
          title="Статистика и отчёты"
          description="Доступ ограничен: административные права отсутствуют."
          activePage="admin"
        >
          <section className="p-6 bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm">
            <p className="text-sm text-slate-600">
              У вас нет доступа к статистике проекта. Если вы считаете, что это ошибка, обратитесь к главному
              организатору.
            </p>
          </section>
        </CabinetLayout>
      </>
    )
  }

  return (
    <>
      <Head>
        <title>ActQuest — Статистика и отчёты</title>
      </Head>
      <CabinetLayout
        title="Статистика и отчёты"
        description="Анализируйте ключевые показатели проекта, следите за динамикой роста и активностью команд."
        activePage="admin"
      >
        <section className="grid gap-6 md:grid-cols-3">
          {summarySections.map((section) => (
            <article
              key={section.id}
              className="p-6 bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm space-y-4"
            >
              <h2 className="text-lg font-semibold text-primary">{section.title}</h2>
              <ul className="space-y-2">
                {section.items.map((item) => (
                  <li key={item.label} className="flex items-baseline justify-between gap-3">
                    <span className="text-sm text-slate-500">{item.label}</span>
                    <span className="text-base font-semibold text-primary">
                      {numberFormatter.format(item.value)}
                    </span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </section>

        <section className="grid gap-6 mt-6 md:grid-cols-2">
          <article className="p-6 bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-primary">Распределение ролей</h2>
              <span className="text-xs text-slate-500">
                Всего: {numberFormatter.format(rolesTotal)}
              </span>
            </div>

            {initialReports.roles.length > 0 ? (
              <div className="space-y-3">
                {initialReports.roles.map((role) => {
                  const percent = rolesTotal > 0 ? Math.round((role.count / rolesTotal) * 100) : 0

                  return (
                    <div key={role.role} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600">{role.label}</span>
                        <span className="font-semibold text-primary">
                          {numberFormatter.format(role.count)} · {percent}%
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-200 rounded-full">
                        <div
                          className="h-2 bg-primary rounded-full"
                          style={{ width: `${Math.min(percent, 100)}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-500">Нет данных о ролях пользователей.</p>
            )}
          </article>

          <article className="p-6 bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm space-y-4">
            <h2 className="text-lg font-semibold text-primary">Топ команд по активности</h2>
            {initialReports.topTeams.length > 0 ? (
              <ul className="space-y-3">
                {initialReports.topTeams.map((team) => (
                  <li
                    key={team.id}
                    className="p-4 border border-slate-200 dark:border-slate-700 rounded-2xl flex flex-col gap-2 md:flex-row md:items-center md:justify-between"
                  >
                    <div>
                      <p className="text-sm font-semibold text-primary">{team.name}</p>
                      <p className="text-xs text-slate-500">
                        Участников: {numberFormatter.format(team.membersCount)} · Игр: {numberFormatter.format(team.gamesCount)}
                      </p>
                    </div>
                    <p className="text-xs text-slate-400">
                      {team.updatedAt
                        ? `Обновлено ${formatRelativeTimeFromNow(team.updatedAt)}`
                        : 'Дата обновления неизвестна'}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">Пока нет активных команд с участниками.</p>
            )}
          </article>
        </section>

        <section className="mt-6 p-6 bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-primary">Недавняя активность</h2>
          {initialReports.recentActivity.length > 0 ? (
            <ul className="space-y-3">
              {initialReports.recentActivity.map((activity) => (
                <li
                  key={activity.id}
                  className="p-4 border border-slate-200 dark:border-slate-700 rounded-2xl flex flex-col gap-2 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <p className="text-sm font-semibold text-primary">{activity.name}</p>
                    <p className="text-xs text-slate-500">{activity.description}</p>
                  </div>
                  <p className="text-xs text-slate-400">
                    {activity.updatedAt
                      ? formatRelativeTimeFromNow(activity.updatedAt)
                      : 'Дата обновления неизвестна'}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">Недавних изменений не обнаружено.</p>
          )}
        </section>
      </CabinetLayout>
    </>
  )
}

ReportsPage.propTypes = {
  initialReports: PropTypes.shape({
    summary: PropTypes.shape({
      totalUsers: PropTypes.number,
      newUsersWeek: PropTypes.number,
      activeUsersMonth: PropTypes.number,
      totalTeams: PropTypes.number,
      openTeams: PropTypes.number,
      closedTeams: PropTypes.number,
      memberships: PropTypes.number,
      uniqueParticipants: PropTypes.number,
      totalGames: PropTypes.number,
      activeGames: PropTypes.number,
      finishedGames: PropTypes.number,
      canceledGames: PropTypes.number,
      gamesLast30: PropTypes.number,
    }),
    roles: PropTypes.arrayOf(
      PropTypes.shape({
        role: PropTypes.string,
        label: PropTypes.string,
        count: PropTypes.number,
      })
    ),
    topTeams: PropTypes.arrayOf(
      PropTypes.shape({
        id: PropTypes.string,
        name: PropTypes.string,
        membersCount: PropTypes.number,
        gamesCount: PropTypes.number,
        updatedAt: PropTypes.string,
      })
    ),
    recentActivity: PropTypes.arrayOf(
      PropTypes.shape({
        id: PropTypes.string,
        type: PropTypes.string,
        name: PropTypes.string,
        description: PropTypes.string,
        updatedAt: PropTypes.string,
      })
    ),
  }),
  initialLocation: PropTypes.string,
  session: PropTypes.object,
}

ReportsPage.defaultProps = {
  initialReports: createEmptyReports(),
  initialLocation: null,
  session: null,
}

export async function getServerSideProps(context) {
  const session = await getSessionSafe(context)

  if (!session) {
    const callbackTarget = context.resolvedUrl || '/cabinet/admin/reports'
    return {
      redirect: {
        destination: `/cabinet/login?callbackUrl=${encodeURIComponent(callbackTarget)}`,
        permanent: false,
      },
    }
  }

  if (!isUserAdmin({ role: session?.user?.role })) {
    return {
      redirect: {
        destination: '/cabinet',
        permanent: false,
      },
    }
  }

  const location = session?.user?.location ?? null
  const initialReports = createEmptyReports()

  if (location) {
    try {
      const db = await dbConnect(location)

      if (db) {
        const UsersModel = db.model('Users')
        const TeamsModel = db.model('Teams')
        const TeamsUsersModel = db.model('TeamsUsers')
        const GamesModel = db.model('Games')
        const GamesTeamsModel = db.model('GamesTeams')

        const [usersDocs, teamsDocs, gamesDocs, teamUsersDocs, gamesTeamsDocs] = await Promise.all([
          UsersModel.find({}).lean(),
          TeamsModel.find({}).lean(),
          GamesModel.find({}).lean(),
          TeamsUsersModel.find({}).lean(),
          GamesTeamsModel.find({}).lean(),
        ])

        const now = Date.now()
        const weekAgo = now - 7 * 24 * 60 * 60 * 1000
        const monthAgo = now - 30 * 24 * 60 * 60 * 1000

        const openTeamsCount = teamsDocs.filter((team) => Boolean(team?.open)).length

        const summary = {
          totalUsers: usersDocs.length,
          newUsersWeek: usersDocs.filter((user) => {
            const createdAt = ensureDateISOString(user?.createdAt)
            return createdAt ? new Date(createdAt).getTime() >= weekAgo : false
          }).length,
          activeUsersMonth: usersDocs.filter((user) => {
            const updatedAt = ensureDateISOString(user?.updatedAt || user?.createdAt)
            return updatedAt ? new Date(updatedAt).getTime() >= monthAgo : false
          }).length,
          totalTeams: teamsDocs.length,
          openTeams: openTeamsCount,
          closedTeams: teamsDocs.length - openTeamsCount,
          memberships: teamUsersDocs.length,
          uniqueParticipants: Array.from(
            new Set(
              teamUsersDocs
                .map((doc) => (Number.isFinite(doc?.userTelegramId) ? doc.userTelegramId : null))
                .filter((id) => id !== null)
            )
          ).length,
          totalGames: gamesDocs.length,
          activeGames: gamesDocs.filter((game) => {
            const status = typeof game?.status === 'string' ? game.status.toLowerCase() : ''
            return status === 'active' || status === 'started'
          }).length,
          finishedGames: gamesDocs.filter((game) => {
            const status = typeof game?.status === 'string' ? game.status.toLowerCase() : ''
            return status === 'finished'
          }).length,
          canceledGames: gamesDocs.filter((game) => {
            const status = typeof game?.status === 'string' ? game.status.toLowerCase() : ''
            return status === 'canceled'
          }).length,
          gamesLast30: gamesDocs.filter((game) => {
            const timestamp = ensureDateISOString(game?.updatedAt || game?.createdAt)
            return timestamp ? new Date(timestamp).getTime() >= monthAgo : false
          }).length,
        }

        const rolesMap = usersDocs.reduce((acc, user) => {
          const role = typeof user?.role === 'string' ? user.role : 'client'
          acc[role] = (acc[role] || 0) + 1
          return acc
        }, {})

        const roles = Object.entries(rolesMap)
          .map(([role, count]) => ({
            role,
            label: roleLabels[role] ?? role,
            count,
          }))
          .sort((a, b) => b.count - a.count)

        const membershipCountsByTeam = teamUsersDocs.reduce((acc, doc) => {
          const teamId = toStringId(doc?.teamId)
          if (!teamId) {
            return acc
          }

          acc[teamId] = (acc[teamId] || 0) + 1
          return acc
        }, {})

        const gamesCountByTeamSet = gamesTeamsDocs.reduce((acc, doc) => {
          const teamId = toStringId(doc?.teamId)
          const gameId = toStringId(doc?.gameId)

          if (!teamId || !gameId) {
            return acc
          }

          if (!acc[teamId]) {
            acc[teamId] = new Set()
          }

          acc[teamId].add(gameId)
          return acc
        }, {})

        const gamesCountByTeam = Object.entries(gamesCountByTeamSet).reduce((acc, [teamId, ids]) => {
          acc[teamId] = ids.size
          return acc
        }, {})

        const topTeams = teamsDocs
          .map((team) => {
            const id = toStringId(team?._id)
            if (!id) {
              return null
            }

            return {
              id,
              name: typeof team?.name === 'string' && team.name.trim().length > 0 ? team.name : 'Без названия',
              membersCount: membershipCountsByTeam[id] ?? 0,
              gamesCount: gamesCountByTeam[id] ?? 0,
              updatedAt: ensureDateISOString(team?.updatedAt),
            }
          })
          .filter(Boolean)
          .sort((a, b) => {
            if (b.membersCount === a.membersCount) {
              return b.gamesCount - a.gamesCount
            }

            return b.membersCount - a.membersCount
          })
          .slice(0, 6)

        const recentActivityCandidates = []

        usersDocs.forEach((user) => {
          const updatedAt = ensureDateISOString(user?.updatedAt || user?.createdAt)
          if (!updatedAt) {
            return
          }

          recentActivityCandidates.push({
            id: `user-${toStringId(user?._id) ?? user?.telegramId ?? Math.random()}`,
            type: 'user',
            name: user?.name?.trim()?.length ? user.name : user?.username ? `@${user.username}` : `ID ${user?.telegramId}`,
            description: `Роль: ${roleLabels[user?.role] ?? user?.role ?? 'Пользователь'}`,
            updatedAt,
          })
        })

        teamsDocs.forEach((team) => {
          const updatedAt = ensureDateISOString(team?.updatedAt || team?.createdAt)
          if (!updatedAt) {
            return
          }

          const id = toStringId(team?._id)
          const membersCount = membershipCountsByTeam[id] ?? 0
          const gamesCount = gamesCountByTeam[id] ?? 0

          recentActivityCandidates.push({
            id: `team-${id}`,
            type: 'team',
            name: typeof team?.name === 'string' && team.name.trim().length > 0 ? team.name : 'Без названия',
            description: `Участников: ${membersCount} · Игр: ${gamesCount}`,
            updatedAt,
          })
        })

        gamesDocs.forEach((game) => {
          const updatedAt = ensureDateISOString(game?.updatedAt || game?.createdAt)
          if (!updatedAt) {
            return
          }

          const id = toStringId(game?._id)
          const status = typeof game?.status === 'string' ? game.status.toLowerCase() : ''
          const statusLabel =
            status === 'active'
              ? 'Активна'
              : status === 'started'
              ? 'Запущена'
              : status === 'finished'
              ? 'Завершена'
              : status === 'canceled'
              ? 'Отменена'
              : 'Без статуса'

          recentActivityCandidates.push({
            id: `game-${id}`,
            type: 'game',
            name: typeof game?.name === 'string' && game.name.trim().length > 0 ? game.name : 'Без названия',
            description: `Статус: ${statusLabel}`,
            updatedAt,
          })
        })

        const recentActivity = recentActivityCandidates
          .filter((item) => item.updatedAt)
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
          .slice(0, 12)

        initialReports.summary = summary
        initialReports.roles = roles
        initialReports.topTeams = topTeams
        initialReports.recentActivity = recentActivity
      }
    } catch (error) {
      console.error('Failed to load reports data', error)
    }
  }

  return {
    props: {
      session,
      initialReports,
      initialLocation: location,
    },
  }
}

export default ReportsPage
