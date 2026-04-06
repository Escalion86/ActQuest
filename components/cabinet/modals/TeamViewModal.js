'use client'

import { useCallback } from 'react'
import PropTypes from 'prop-types'
import { useQuery } from '@tanstack/react-query'

import Modal from '@components/Modal'
import FormSectionCard from '@components/cabinet/FormSectionCard'
import CabinetButton from '@components/cabinet/CabinetButton'
import NoticeBanner from '@components/NoticeBanner'
import fetchCabinetTeamDetails from '@helpers/fetchCabinetTeamDetails'
import formatRelativeTimeFromNow from '@helpers/formatRelativeTimeFromNow'

const modalItemTitleClass = 'font-semibold text-slate-800 dark:text-slate-100'
const modalSectionTitleClass =
  'font-semibold text-sm text-slate-700 dark:text-slate-200'

const TeamViewModal = ({ teamId, isOpen, onClose, onOpenMember }) => {
  const {
    data: team,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['team', teamId],
    queryFn: () => fetchCabinetTeamDetails({ teamId }),
    enabled: isOpen && !!teamId,
    staleTime: 1000 * 60 * 5,
  })

  const handleClose = useCallback(() => {
    onClose()
  }, [onClose])

  return (
    <Modal
      isOpen={isOpen && Boolean(team)}
      onClose={handleClose}
      title={`Команда — ${team?.name || 'Без имени'}`}
    >
      {isLoading ? (
        <p className="text-sm text-slate-500">
          Загружаем информацию о команде...
        </p>
      ) : error ? (
        <NoticeBanner tone="error" variant="neon">
          {error}
        </NoticeBanner>
      ) : team ? (
        <div className="space-y-6">
          <FormSectionCard className="space-y-6">
            <div className="flex items-start gap-3">
              {team.image && (
                <img
                  src={team.image}
                  alt={team.name || 'Логотип команды'}
                  className="h-[200px] w-[200px] shrink-0 rounded-xl border border-slate-200 object-cover dark:border-slate-700"
                  loading="lazy"
                />
              )}
              <div className="min-w-0">
                <h2 className={modalItemTitleClass}>
                  {team.name || 'Без имени'}
                </h2>
                {team.location && (
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    Город: {team.location}
                  </p>
                )}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl dark:bg-sky-500/10 dark:border-sky-500/30">
                <p className="text-xs text-blue-600 dark:text-sky-300">
                  Участников
                </p>
                <p className="mt-1 text-xl font-semibold text-primary dark:text-sky-100">
                  {team.membersCount || 0}
                </p>
              </div>
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl dark:bg-emerald-500/10 dark:border-emerald-500/30">
                <p className="text-xs text-emerald-600 dark:text-emerald-300">
                  Игры
                </p>
                <p className="mt-1 text-xl font-semibold text-emerald-700 dark:text-emerald-100">
                  {team.gamesCount || 0}
                </p>
              </div>
              <div className="p-4 bg-slate-50 border border-slate-200 dark:bg-slate-800/70 dark:border-slate-700 rounded-xl">
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Последнее обновление
                </p>
                <p className="mt-1 text-sm text-slate-700 dark:text-slate-100">
                  {team.updatedAt
                    ? formatRelativeTimeFromNow(team.updatedAt)
                    : 'Неизвестно'}
                </p>
              </div>
            </div>
          </FormSectionCard>

          {team.members && team.members.length > 0 && (
            <FormSectionCard className="space-y-4">
              <h3 className={modalSectionTitleClass}>Участники команды</h3>
              <ul className="space-y-3">
                {team.members.map((member) => (
                  <li key={member.id || member.userId}>
                    <button
                      type="button"
                      onClick={() => onOpenMember && onOpenMember(member)}
                      className="w-full p-3 text-left border border-slate-200 rounded-xl hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm text-slate-800 dark:text-slate-100">
                          {member.name || 'Без имени'}
                        </span>
                        {member.role && (
                          <span className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded-full dark:bg-sky-500/10 dark:text-sky-200">
                            {member.role}
                          </span>
                        )}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </FormSectionCard>
          )}

          {team.description && (
            <FormSectionCard className="space-y-3">
              <h3 className={modalSectionTitleClass}>Описание</h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line">
                {team.description}
              </p>
            </FormSectionCard>
          )}
        </div>
      ) : null}
    </Modal>
  )
}

TeamViewModal.propTypes = {
  teamId: PropTypes.string,
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onOpenMember: PropTypes.func,
}

TeamViewModal.defaultProps = {
  teamId: null,
  onOpenMember: null,
}

export default TeamViewModal
