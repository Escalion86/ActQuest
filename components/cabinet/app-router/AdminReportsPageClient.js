'use client'

import { useCallback, useMemo, useState } from 'react'
import PropTypes from 'prop-types'

import CabinetLayout from '@components/cabinet/CabinetLayout'
import UserTeamCard from '@components/cabinet/cards/UserTeamCard'
import TeamDescriptionModal from '@components/modals/TeamDescriptionModal'
import formatRelativeTimeFromNow from '@helpers/formatRelativeTimeFromNow'
import CABINET_ROLE_LABELS from '@helpers/cabinetRoleLabels'
import fetchCabinetTeamDetails from '@helpers/fetchCabinetTeamDetails'
import isUserAdmin from '@helpers/isUserAdmin'
import useCabinetRolePreview from '@helpers/useCabinetRolePreview'
import useMergedSession from '@helpers/useMergedSession'

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

const ReportsPage = ({
  initialReports,
  initialLocation,
  session: initialSession,
}) => {
  const safeInitialReports =
    initialReports &&
    typeof initialReports === 'object' &&
    initialReports.summary &&
    typeof initialReports.summary === 'object'
      ? initialReports
      : createEmptyReports()

  const { activeSession } = useMergedSession(initialSession)
  const { effectiveRole } = useCabinetRolePreview(
    activeSession?.user?.role ?? 'client',
  )
  const isAdmin = isUserAdmin({ role: effectiveRole })

  const numberFormatter = useMemo(() => new Intl.NumberFormat('ru-RU'), [])
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false)
  const [selectedTeam, setSelectedTeam] = useState(null)
  const [isTeamLoading, setIsTeamLoading] = useState(false)
  const [teamLoadError, setTeamLoadError] = useState('')

  const handleCloseTeamModal = useCallback(() => {
    setIsTeamModalOpen(false)
    setSelectedTeam(null)
    setIsTeamLoading(false)
    setTeamLoadError('')
  }, [])

  const handleOpenTeam = useCallback(async (team) => {
    if (!team?.id) {
      return
    }

    setIsTeamLoading(true)
    setTeamLoadError('')
    setIsTeamModalOpen(true)

    try {
      const detailedTeam = await fetchCabinetTeamDetails({ teamId: team.id })
      setSelectedTeam(detailedTeam)
    } catch (error) {
      setTeamLoadError(error?.message || 'Не удалось загрузить команду')
      setSelectedTeam(null)
    } finally {
      setIsTeamLoading(false)
    }
  }, [])

  const summarySections = useMemo(() => {
    const summary = safeInitialReports.summary

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
  }, [safeInitialReports.summary])

  if (!isAdmin) {
    return (
      <>
        <CabinetLayout
          title="Статистика и отчёты"
          description="Доступ ограничен: административные права отсутствуют."
          activePage="admin"
        >
          <section className="p-6 bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm">
            <p className="text-sm text-slate-600">
              У вас нет доступа к статистике проекта. Если вы считаете, что это
              ошибка, обратитесь к главному организатору.
            </p>
          </section>
        </CabinetLayout>
      </>
    )
  }

  return (
    <>
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
              <h2 className="text-lg font-semibold text-primary dark:text-slate-100">
                {section.title}
              </h2>
              <ul className="space-y-2">
                {section.items.map((item) => (
                  <li
                    key={item.label}
                    className="flex items-baseline justify-between gap-3"
                  >
                    <span className="text-sm text-slate-500 dark:text-slate-300">
                      {item.label}
                    </span>
                    <span className="text-base font-semibold text-primary dark:text-slate-100">
                      {numberFormatter.format(item.value)}
                    </span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </section>

        <section className="grid gap-6 mt-6 md:grid-cols-1">
          <article className="p-6 bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm space-y-4">
            <h2 className="text-lg font-semibold text-primary dark:text-slate-100">
              Топ команд по активности
            </h2>
            {safeInitialReports.topTeams.length > 0 ? (
              <ul className="space-y-3">
                {safeInitialReports.topTeams.map((team) => (
                  <li key={team.id}>
                    <UserTeamCard
                      team={team}
                      onOpen={handleOpenTeam}
                      metaText={`Участников: ${numberFormatter.format(team.membersCount)} · Сыграно игр: ${numberFormatter.format(team.gamesCount)}`}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">
                Пока нет активных команд с участниками.
              </p>
            )}
          </article>
        </section>

        <section className="mt-6 p-6 bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-primary dark:text-slate-100">
            Недавняя активность
          </h2>
          {safeInitialReports.recentActivity.length > 0 ? (
            <ul className="space-y-3">
              {safeInitialReports.recentActivity.map((activity) => (
                <li
                  key={activity.id}
                  className="p-4 border border-slate-200 dark:border-slate-700 rounded-2xl flex flex-col gap-2 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <p className="text-sm font-semibold text-primary dark:text-slate-100">
                      {activity.name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-300">
                      {activity.description}
                    </p>
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
            <p className="text-sm text-slate-500">
              Недавних изменений не обнаружено.
            </p>
          )}
        </section>
        <TeamDescriptionModal
          isOpen={isTeamModalOpen && !isTeamLoading && Boolean(selectedTeam)}
          onClose={handleCloseTeamModal}
          selectedTeam={selectedTeam}
        />
      </CabinetLayout>
      {isTeamModalOpen && isTeamLoading ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/45 px-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900/95">
            <p className="text-sm text-slate-500 dark:text-slate-300">
              Загружаем данные команды...
            </p>
          </div>
        </div>
      ) : null}
      {isTeamModalOpen && !isTeamLoading && teamLoadError ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/45 px-4">
          <div className="w-full max-w-md rounded-2xl border border-rose-300 bg-white p-6 shadow-xl dark:border-rose-500/50 dark:bg-slate-900/95">
            <p className="text-sm text-rose-600 dark:text-rose-300">
              {teamLoadError}
            </p>
            <button
              type="button"
              onClick={handleCloseTeamModal}
              className="mt-4 inline-flex cursor-pointer items-center justify-center rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              Закрыть
            </button>
          </div>
        </div>
      ) : null}
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
      }),
    ),
    topTeams: PropTypes.arrayOf(
      PropTypes.shape({
        id: PropTypes.string,
        name: PropTypes.string,
        membersCount: PropTypes.number,
        gamesCount: PropTypes.number,
        updatedAt: PropTypes.string,
      }),
    ),
    recentActivity: PropTypes.arrayOf(
      PropTypes.shape({
        id: PropTypes.string,
        type: PropTypes.string,
        name: PropTypes.string,
        description: PropTypes.string,
        updatedAt: PropTypes.string,
      }),
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

export default ReportsPage
