import { memo, useCallback, useEffect, useState } from 'react'
import PropTypes from 'prop-types'

import Modal from '@components/Modal'
import CabinetButton from '@components/cabinet/CabinetButton'
import CabinetSelectField from '@components/cabinet/CabinetSelectField'
import FormSectionCard from '@components/cabinet/FormSectionCard'
import NoticeBanner from '@components/NoticeBanner'
import fetchCabinetTeamDetails from '@helpers/fetchCabinetTeamDetails'
import TeamDescriptionModal from './TeamDescriptionModal'

const resolveRatingBadge = (rating) =>
  rating?.isEligible && Number.isFinite(rating?.rank) ? `#${rating.rank}` : null

const GameTeamsModal = ({
  selectedGame,
  isTeamsModalOpen,
  handleCloseTeamsModal,
  teamsModalState,
  removingTeamIds,
  selectedTeamToAdd,
  setSelectedTeamToAdd,
  handleAddTeamToGame,
  isAddingTeam,
  handleRemoveTeamFromGame,
  currentUserRole,
  isReadOnly = false,
}) => {
  const [isTeamDetailsModalOpen, setIsTeamDetailsModalOpen] = useState(false)
  const [isTeamDetailsLoading, setIsTeamDetailsLoading] = useState(false)
  const [selectedTeamDetails, setSelectedTeamDetails] = useState(null)
  const [teamDetailsError, setTeamDetailsError] = useState('')
  const [isRestrictedDeleteModalOpen, setIsRestrictedDeleteModalOpen] =
    useState(false)
  const [restrictedDeleteTeamName, setRestrictedDeleteTeamName] = useState('')

  const closeTeamDetailsModal = useCallback(() => {
    setIsTeamDetailsModalOpen(false)
    setIsTeamDetailsLoading(false)
    setTeamDetailsError('')
  }, [])

  const closeRestrictedDeleteModal = useCallback(() => {
    setIsRestrictedDeleteModalOpen(false)
    setRestrictedDeleteTeamName('')
  }, [])

  useEffect(() => {
    if (!isTeamsModalOpen) {
      setIsTeamDetailsModalOpen(false)
      setSelectedTeamDetails(null)
      setIsTeamDetailsLoading(false)
      setTeamDetailsError('')
      setIsRestrictedDeleteModalOpen(false)
      setRestrictedDeleteTeamName('')
    }
  }, [isTeamsModalOpen])

  const handleOpenTeamDetails = useCallback(async (team) => {
    if (!team) {
      return
    }

    const membersCount = Number.isFinite(team?.membersCount)
      ? team.membersCount
      : 0
    const fallbackTeamDetails = {
      id: team?.teamId || team?.id || '',
      name: team?.teamName || 'Без названия',
      description: team?.teamDescription || '',
      image: team?.teamImage || '',
      open: Boolean(team?.open),
      membersCount,
      gamesCount: 0,
      captain: null,
      members: [],
      games: [],
      updatedAt: team?.updatedAt || null,
      createdAt: null,
    }

    const normalizedTeamDetails = team?.teamDetails
      ? {
          ...team.teamDetails,
          id: team.teamDetails.id || fallbackTeamDetails.id,
          name: team.teamDetails.name || fallbackTeamDetails.name,
          description:
            team.teamDetails.description || fallbackTeamDetails.description,
          image: team.teamDetails.image || fallbackTeamDetails.image,
          open:
            typeof team.teamDetails.open === 'boolean'
              ? team.teamDetails.open
              : fallbackTeamDetails.open,
          membersCount: Number.isFinite(team.teamDetails.membersCount)
            ? team.teamDetails.membersCount
            : fallbackTeamDetails.membersCount,
        }
      : fallbackTeamDetails

    setSelectedTeamDetails(normalizedTeamDetails)
    setIsTeamDetailsModalOpen(true)
    setTeamDetailsError('')
    setIsTeamDetailsLoading(true)

    try {
      const detailedTeam = await fetchCabinetTeamDetails({
        teamId: fallbackTeamDetails.id,
      })
      setSelectedTeamDetails(detailedTeam)
    } catch (error) {
      setTeamDetailsError(error?.message || 'Не удалось загрузить команду')
    } finally {
      setIsTeamDetailsLoading(false)
    }
  }, [])

  return (
    <>
      <Modal
        isOpen={isTeamsModalOpen}
        title={`Команды игры «${selectedGame?.name || 'Без названия'}»`}
        onClose={handleCloseTeamsModal}
      >
        {selectedGame ? (
          <div className="space-y-5">
            {teamsModalState.error && (
              <NoticeBanner tone="error" variant="neon">
                {teamsModalState.error}
              </NoticeBanner>
            )}
            {teamDetailsError && (
              <NoticeBanner tone="error" variant="neon">
                {teamDetailsError}
              </NoticeBanner>
            )}

            <div className="space-y-4">
              {teamsModalState.isLoading ? (
                <p className="text-sm text-slate-500 dark:text-slate-300">
                  Загружаем список команд…
                </p>
              ) : teamsModalState.gameTeams.length > 0 ? (
                <ul className="space-y-3">
                  {teamsModalState.gameTeams.map((team) => {
                    const isRemoving = removingTeamIds.includes(team.id)
                    const membersCount = Number.isFinite(team?.membersCount)
                      ? team.membersCount
                      : 0
                    const ratingBadge = resolveRatingBadge(team?.rating)

                    return (
                      <li key={team.id}>
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => handleOpenTeamDetails(team)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              handleOpenTeamDetails(team)
                            }
                          }}
                          className="w-full cursor-pointer text-left p-4 border rounded-2xl transition border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/80 hover:border-primary hover:bg-blue-50 dark:hover:border-[#7A00FF]/60 dark:hover:bg-[#110a24]"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0 flex items-center gap-3">
                              <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800/80">
                                <img
                                  src={
                                    team.teamImage || '/img/avatars/team.png'
                                  }
                                  alt={`Иконка команды ${team.teamName}`}
                                  className="h-full w-full object-cover"
                                />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  {ratingBadge ? (
                                    <span className="text-xs font-medium px-2 py-1 rounded-full border border-cyan-300 bg-cyan-50 text-cyan-700 dark:border-cyan-500/40 dark:bg-cyan-500/10 dark:text-cyan-200">
                                      {ratingBadge}
                                    </span>
                                  ) : (
                                    <span className="text-xs font-medium px-2 py-1 rounded-full border border-slate-300 bg-slate-100 text-slate-600 dark:border-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
                                      Без рейтинга
                                    </span>
                                  )}
                                  <p className="text-sm font-semibold text-primary dark:text-slate-100">
                                    {team.teamName}
                                  </p>
                                </div>
                                <p className="text-xs text-slate-500">
                                  Участников: {membersCount}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-xs font-medium px-2 py-1 rounded-full ${
                                  team.open
                                    ? 'border border-sky-300 bg-sky-100 text-sky-700 dark:border-[#00D1FF]/35 dark:bg-[#00D1FF]/12 dark:text-[#bdf4ff]'
                                    : 'border border-violet-300 bg-violet-100 text-violet-700 dark:border-[#7A00FF]/35 dark:bg-[#7A00FF]/12 dark:text-[#d9c8ff]'
                                }`}
                              >
                                {team.open ? 'Открыта' : 'Закрыта'}
                              </span>
                              {!isReadOnly && (
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    // Временное ограничение: обычные пользователи не могут удалять команды
                                    if (currentUserRole === 'client') {
                                      setIsRestrictedDeleteModalOpen(true)
                                      setRestrictedDeleteTeamName(
                                        team.teamName || 'Без названия',
                                      )
                                      return
                                    }
                                    if (typeof window !== 'undefined') {
                                      const confirmed = window.confirm(
                                        `Удалить команду «${team.teamName || 'Без названия'}» из игры?`,
                                      )
                                      if (!confirmed) {
                                        return
                                      }
                                    }
                                    handleRemoveTeamFromGame(team.id)
                                  }}
                                  disabled={
                                    isRemoving || teamsModalState.isLoading
                                  }
                                  aria-label={`Удалить команду ${team.teamName || ''} из игры`}
                                  className={`flex h-8 w-8 items-center justify-center rounded-lg border transition
                                    ${isRemoving || teamsModalState.isLoading
                                      ? 'cursor-wait border-slate-200 bg-slate-100 text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-600'
                                      : 'border-red-200 bg-red-50 text-red-500 hover:border-red-400 hover:bg-red-100 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400 dark:hover:border-red-400/60 dark:hover:bg-red-500/20'
                                    }`}
                                >
                                  {isRemoving ? (
                                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                                    </svg>
                                  ) : (
                                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                                      <polyline points="3 6 5 6 21 6" />
                                      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                                      <path d="M10 11v6M14 11v6" />
                                      <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                                    </svg>
                                  )}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p className="text-sm text-slate-500 dark:text-slate-300">
                  Пока ни одна команда не зарегистрирована на эту игру.
                </p>
              )}
            </div>

            {!isReadOnly && (
              <FormSectionCard className="bg-slate-50 p-4 dark:bg-slate-800/60">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Добавить команду
                </h3>
                {teamsModalState.availableTeams.length > 0 ? (
                  <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                    <CabinetSelectField
                      id="game-team-to-add"
                      label={null}
                      value={selectedTeamToAdd}
                      onChange={(event) =>
                        setSelectedTeamToAdd(event.target.value)
                      }
                      containerClassName="w-full space-y-0"
                      selectClassName="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-primary focus:outline-none dark:border-slate-700"
                    >
                      {teamsModalState.availableTeams.map((team) => {
                        const availableMembersCount = Number.isFinite(
                          team?.membersCount,
                        )
                          ? team.membersCount
                          : Array.isArray(team?.members)
                            ? team.members.length
                            : 0

                        return (
                          <option key={team.id} value={team.id}>
                            {`${team.name} (${availableMembersCount})`}
                          </option>
                        )
                      })}
                    </CabinetSelectField>
                    <CabinetButton
                      onClick={handleAddTeamToGame}
                      disabled={
                        !selectedTeamToAdd ||
                        isAddingTeam ||
                        teamsModalState.isLoading
                      }
                      variant="primary"
                      size="md"
                      className={`inline-flex justify-center ${
                        isAddingTeam ? 'cursor-wait' : ''
                      }`}
                    >
                      {isAddingTeam ? 'Добавление…' : 'Добавить'}
                    </CabinetButton>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">
                    Свободных команд не найдено. Создайте команду или освободите
                    её от участия в игре.
                  </p>
                )}
              </FormSectionCard>
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-300">
            Игра не выбрана. Закройте окно и выберите игру снова.
          </p>
        )}
      </Modal>
      <TeamDescriptionModal
        isOpen={isTeamDetailsModalOpen}
        onClose={closeTeamDetailsModal}
        selectedTeam={selectedTeamDetails}
      />
      <Modal
        isOpen={isTeamDetailsLoading}
        onClose={() => setIsTeamDetailsLoading(false)}
        title="Команда"
      >
        <p className="text-sm text-slate-500">Загружаем данные команды...</p>
      </Modal>
      <Modal
        isOpen={isRestrictedDeleteModalOpen}
        onClose={closeRestrictedDeleteModal}
        title="Удаление команды запрещено"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-700 dark:text-slate-200">
            Удаление команды <strong>«{restrictedDeleteTeamName}»</strong>{' '}
            невозможно.
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Для удаления команды из игры необходимо обратиться к администратору
            проекта.
          </p>
        </div>
      </Modal>
    </>
  )
}

const teamShape = PropTypes.shape({
  id: PropTypes.string.isRequired,
  teamName: PropTypes.string,
  teamDescription: PropTypes.string,
  teamImage: PropTypes.string,
  teamId: PropTypes.string,
  open: PropTypes.bool,
  updatedAt: PropTypes.string,
  membersCount: PropTypes.number,
  rating: PropTypes.shape({
    rank: PropTypes.number,
    isEligible: PropTypes.bool,
  }),
  teamDetails: PropTypes.object,
})

const availableTeamShape = PropTypes.shape({
  id: PropTypes.string.isRequired,
  name: PropTypes.string,
  members: PropTypes.array,
  membersCount: PropTypes.number,
})

GameTeamsModal.propTypes = {
  selectedGame: PropTypes.shape({ name: PropTypes.string }),
  isTeamsModalOpen: PropTypes.bool.isRequired,
  handleCloseTeamsModal: PropTypes.func.isRequired,
  teamsModalState: PropTypes.shape({
    isLoading: PropTypes.bool.isRequired,
    error: PropTypes.string,
    gameTeams: PropTypes.arrayOf(teamShape).isRequired,
    availableTeams: PropTypes.arrayOf(availableTeamShape).isRequired,
  }).isRequired,
  removingTeamIds: PropTypes.arrayOf(PropTypes.string).isRequired,
  selectedTeamToAdd: PropTypes.string,
  setSelectedTeamToAdd: PropTypes.func.isRequired,
  handleAddTeamToGame: PropTypes.func.isRequired,
  isAddingTeam: PropTypes.bool.isRequired,
  handleRemoveTeamFromGame: PropTypes.func.isRequired,
  isReadOnly: PropTypes.bool,
}

GameTeamsModal.defaultProps = {
  selectedGame: null,
  selectedTeamToAdd: '',
}

export default memo(GameTeamsModal)
