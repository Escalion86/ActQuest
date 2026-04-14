import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'

import Modal from '@components/Modal'
import CabinetButton from '@components/cabinet/CabinetButton'
import CabinetSelectField from '@components/cabinet/CabinetSelectField'
import FormSectionCard from '@components/cabinet/FormSectionCard'
import NoticeBanner from '@components/NoticeBanner'
import fetchCabinetTeamDetails from '@helpers/fetchCabinetTeamDetails'
import requestApiJson from '@helpers/requestApiJson'
import { LOCATIONS } from '@server/serverConstants'
import TeamDescriptionModal from './TeamDescriptionModal'

const resolveRatingBadge = (rating) =>
  rating?.isEligible && Number.isFinite(rating?.rank) ? `#${rating.rank}` : null

const OpenDoorIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className="h-3.5 w-3.5"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M4 3h11v18H4z" />
    <path d="M15 6h4l1 3v9l-1 3h-4" />
    <circle cx="10.5" cy="12" r="0.8" fill="currentColor" stroke="none" />
  </svg>
)

const ClosedDoorIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className="h-3.5 w-3.5"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M4 3h11v18H4z" />
    <path d="M15 6h4v12h-4" />
    <line x1="3.5" y1="20.5" x2="20.5" y2="3.5" />
    <circle cx="10.5" cy="12" r="0.8" fill="currentColor" stroke="none" />
  </svg>
)

const GameTeamsModal = ({
  selectedGame,
  isTeamsModalOpen,
  handleCloseTeamsModal,
  teamsModalState,
  removingTeamIds,
  updatingOutOfCompetitionTeamIds,
  selectedTeamToAdd,
  setSelectedTeamToAdd,
  handleAddTeamToGame,
  isAddingTeam,
  handleRemoveTeamFromGame,
  handleToggleTeamOutOfCompetition,
  handleRefreshTeamsModalData,
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
  const [isTeamEditModalOpen, setIsTeamEditModalOpen] = useState(false)
  const [teamToEdit, setTeamToEdit] = useState(null)
  const [isSavingTeamEdit, setIsSavingTeamEdit] = useState(false)
  const [teamEditError, setTeamEditError] = useState('')

  const closeTeamDetailsModal = useCallback(() => {
    setIsTeamDetailsModalOpen(false)
    setIsTeamDetailsLoading(false)
    setTeamDetailsError('')
  }, [])

  const closeRestrictedDeleteModal = useCallback(() => {
    setIsRestrictedDeleteModalOpen(false)
    setRestrictedDeleteTeamName('')
  }, [])

  const gameStatus = String(selectedGame?.status || '')
    .trim()
    .toLowerCase()
  const canAddTeams =
    !isReadOnly && gameStatus === 'active' && selectedGame?.registrationOpen !== false
  const canEditRegisteredTeams =
    !isReadOnly && ['dev', 'admin', 'moder'].includes(String(currentUserRole || '').toLowerCase())
  const locationOptions = useMemo(
    () =>
      Object.entries(LOCATIONS)
        .filter(([, location]) => !location?.hidden)
        .map(([value, location]) => ({
          value,
          label:
            typeof location?.townRu === 'string' && location.townRu.trim()
              ? location.townRu.trim()
              : value,
        })),
    [],
  )

  useEffect(() => {
    if (!isTeamsModalOpen) {
      setIsTeamDetailsModalOpen(false)
      setSelectedTeamDetails(null)
      setIsTeamDetailsLoading(false)
      setTeamDetailsError('')
      setIsRestrictedDeleteModalOpen(false)
      setRestrictedDeleteTeamName('')
      setIsTeamEditModalOpen(false)
      setTeamToEdit(null)
      setIsSavingTeamEdit(false)
      setTeamEditError('')
    }
  }, [isTeamsModalOpen])

  const handleOpenTeamEdit = useCallback((team) => {
    if (!team) {
      return
    }

    const details = team?.teamDetails && typeof team.teamDetails === 'object'
      ? team.teamDetails
      : {}
    const draft = {
      id: String(team?.teamId || team?.id || '').trim(),
      name: String(details?.name || team?.teamName || '').trim(),
      description: String(details?.description || team?.teamDescription || ''),
      image: String(details?.image || team?.teamImage || ''),
      open: Boolean(
        typeof details?.open === 'boolean' ? details.open : team?.open,
      ),
      location: String(details?.location || ''),
    }

    if (!draft.id) {
      setTeamEditError('Не удалось определить команду для редактирования')
      return
    }

    setTeamToEdit(draft)
    setTeamEditError('')
    setIsTeamEditModalOpen(true)
  }, [])

  const handleCloseTeamEdit = useCallback(() => {
    if (isSavingTeamEdit) {
      return
    }
    setIsTeamEditModalOpen(false)
    setTeamToEdit(null)
    setTeamEditError('')
  }, [isSavingTeamEdit])

  const handleTeamEditFieldChange = useCallback((field, value) => {
    setTeamToEdit((prev) => (prev ? { ...prev, [field]: value } : prev))
  }, [])

  const handleSaveTeamEdit = useCallback(async () => {
    if (!teamToEdit?.id || !selectedGame?.id) {
      setTeamEditError('Не передан идентификатор команды')
      return
    }
    if (!String(teamToEdit.name || '').trim()) {
      setTeamEditError('Введите название команды')
      return
    }

    setIsSavingTeamEdit(true)
    setTeamEditError('')

    try {
      await requestApiJson(
        `/api/cabinet/games/${encodeURIComponent(String(selectedGame.id))}/teams`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update_team_profile',
            teamId: teamToEdit.id,
            update: {
              name: String(teamToEdit.name || '').trim(),
              description: String(teamToEdit.description || ''),
              image: String(teamToEdit.image || ''),
              open: Boolean(teamToEdit.open),
              location: String(teamToEdit.location || '').trim(),
            },
          }),
          fallbackMessage: 'Не удалось сохранить изменения команды',
        },
      )

      if (typeof handleRefreshTeamsModalData === 'function') {
        await handleRefreshTeamsModalData()
      }
      setIsTeamEditModalOpen(false)
      setTeamToEdit(null)
    } catch (error) {
      setTeamEditError(
        error?.message || 'Не удалось сохранить изменения команды',
      )
    } finally {
      setIsSavingTeamEdit(false)
    }
  }, [handleRefreshTeamsModalData, selectedGame?.id, teamToEdit])

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
                    const isUpdatingOutOfCompetition =
                      updatingOutOfCompetitionTeamIds.includes(team.id)
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
                                  <span
                                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium ${
                                      team.open
                                        ? 'border-sky-300 bg-sky-100 text-sky-700 dark:border-[#00D1FF]/35 dark:bg-[#00D1FF]/12 dark:text-[#bdf4ff]'
                                        : 'border-red-300 bg-red-100 text-red-700 dark:border-red-500/45 dark:bg-red-500/14 dark:text-red-200'
                                    }`}
                                    title={team.open ? 'Открыта' : 'Закрыта'}
                                  >
                                    {team.open ? <OpenDoorIcon /> : <ClosedDoorIcon />}
                                  </span>
                                  {team.outOfCompetition ? (
                                    <span className="text-xs font-medium px-2 py-1 rounded-full border border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
                                      Вне зачёта
                                    </span>
                                  ) : null}
                                  <p className="text-sm font-semibold text-primary dark:text-slate-100">
                                    {team.teamName}
                                  </p>
                                </div>
                                <p className="text-xs text-slate-500">
                                  Участников: {membersCount}
                                </p>
                                {!isReadOnly ? (
                                  <label
                                    className="mt-2 inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300"
                                    onClick={(event) => event.stopPropagation()}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={Boolean(team.outOfCompetition)}
                                      disabled={
                                        currentUserRole === 'client' ||
                                        isUpdatingOutOfCompetition ||
                                        teamsModalState.isLoading
                                      }
                                      onChange={(event) => {
                                        handleToggleTeamOutOfCompetition({
                                          gameTeamId: team.id,
                                          outOfCompetition: Boolean(
                                            event.target.checked,
                                          ),
                                        })
                                      }}
                                      className="h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-400 dark:border-slate-600"
                                    />
                                    Вне зачёта
                                  </label>
                                ) : null}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {canEditRegisteredTeams ? (
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    handleOpenTeamEdit(team)
                                  }}
                                  aria-label={`Редактировать команду ${team.teamName || ''}`}
                                  title="Редактировать команду"
                                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-200 bg-cyan-50 text-cyan-600 transition hover:border-cyan-400 hover:bg-cyan-100 dark:border-cyan-500/35 dark:bg-cyan-500/10 dark:text-cyan-300 dark:hover:border-cyan-400/65 dark:hover:bg-cyan-500/20"
                                >
                                  <svg
                                    className="h-4 w-4"
                                    viewBox="0 0 20 20"
                                    fill="none"
                                    xmlns="http://www.w3.org/2000/svg"
                                  >
                                    <path
                                      d="M4 13.5V16h2.5L15 7.5l-2.5-2.5L4 13.5z"
                                      stroke="currentColor"
                                      strokeWidth="1.5"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    />
                                    <path
                                      d="M11.5 5l2.5 2.5"
                                      stroke="currentColor"
                                      strokeWidth="1.5"
                                      strokeLinecap="round"
                                    />
                                  </svg>
                                </button>
                              ) : null}
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
                                    isRemoving ||
                                    isUpdatingOutOfCompetition ||
                                    teamsModalState.isLoading
                                  }
                                  aria-label={`Удалить команду ${team.teamName || ''} из игры`}
                                  className={`flex h-8 w-8 items-center justify-center rounded-lg border transition
                                    ${
                                      isRemoving || teamsModalState.isLoading
                                        ? 'cursor-wait border-slate-200 bg-slate-100 text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-600'
                                        : 'border-red-200 bg-red-50 text-red-500 hover:border-red-400 hover:bg-red-100 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400 dark:hover:border-red-400/60 dark:hover:bg-red-500/20'
                                    }`}
                                >
                                  {isRemoving ? (
                                    <svg
                                      className="h-4 w-4 animate-spin"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                    >
                                      <circle
                                        className="opacity-25"
                                        cx="12"
                                        cy="12"
                                        r="10"
                                        stroke="currentColor"
                                        strokeWidth="4"
                                      />
                                      <path
                                        className="opacity-75"
                                        fill="currentColor"
                                        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                                      />
                                    </svg>
                                  ) : (
                                    <svg
                                      className="h-4 w-4"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="1.75"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    >
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

            {canAddTeams && (
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
      <Modal
        isOpen={isTeamEditModalOpen}
        onClose={handleCloseTeamEdit}
        title={`Редактирование команды «${teamToEdit?.name || 'Без названия'}»`}
        footer={
          <>
            <button
              type="button"
              className="aq-modal-btn aq-modal-btn-secondary"
              onClick={handleCloseTeamEdit}
              disabled={isSavingTeamEdit}
            >
              Отмена
            </button>
            <button
              type="button"
              className={`aq-modal-btn aq-modal-btn-primary ${isSavingTeamEdit ? 'cursor-wait' : ''}`}
              onClick={handleSaveTeamEdit}
              disabled={isSavingTeamEdit}
            >
              {isSavingTeamEdit ? 'Сохранение…' : 'Сохранить и закрыть'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {teamEditError ? (
            <NoticeBanner tone="error" variant="neon">
              {teamEditError}
            </NoticeBanner>
          ) : null}
          <div>
            <label
              htmlFor="game-team-edit-name"
              className="text-sm font-semibold text-slate-700 dark:text-slate-100"
            >
              Название команды
            </label>
            <input
              id="game-team-edit-name"
              type="text"
              value={teamToEdit?.name || ''}
              onChange={(event) =>
                handleTeamEditFieldChange('name', event.target.value)
              }
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-800 focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100"
            />
          </div>
          <CabinetSelectField
            id="game-team-edit-location"
            label="Город команды"
            value={teamToEdit?.location || ''}
            onChange={(event) =>
              handleTeamEditFieldChange('location', event.target.value)
            }
            labelClassName="text-sm font-semibold text-slate-700 dark:text-slate-100"
            selectClassName="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-800 focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100"
          >
            <option value="">Не указан</option>
            {locationOptions.map((locationOption) => (
              <option key={locationOption.value} value={locationOption.value}>
                {locationOption.label}
              </option>
            ))}
          </CabinetSelectField>
          <div>
            <label
              htmlFor="game-team-edit-description"
              className="text-sm font-semibold text-slate-700 dark:text-slate-100"
            >
              Описание
            </label>
            <textarea
              id="game-team-edit-description"
              value={teamToEdit?.description || ''}
              rows={4}
              onChange={(event) =>
                handleTeamEditFieldChange('description', event.target.value)
              }
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-800 focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100"
            />
          </div>
          <div>
            <label
              htmlFor="game-team-edit-image"
              className="text-sm font-semibold text-slate-700 dark:text-slate-100"
            >
              URL аватарки
            </label>
            <input
              id="game-team-edit-image"
              type="text"
              value={teamToEdit?.image || ''}
              onChange={(event) =>
                handleTeamEditFieldChange('image', event.target.value)
              }
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-800 focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100"
            />
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              checked={Boolean(teamToEdit?.open)}
              onChange={(event) =>
                handleTeamEditFieldChange('open', event.target.checked)
              }
              className="h-4 w-4 rounded border-slate-300 text-cyan-500 focus:ring-cyan-400 dark:border-slate-600"
            />
            Команда открыта для вступления
          </label>
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
  outOfCompetition: PropTypes.bool,
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
  updatingOutOfCompetitionTeamIds: PropTypes.arrayOf(PropTypes.string)
    .isRequired,
  selectedTeamToAdd: PropTypes.string,
  setSelectedTeamToAdd: PropTypes.func.isRequired,
  handleAddTeamToGame: PropTypes.func.isRequired,
  isAddingTeam: PropTypes.bool.isRequired,
  handleRemoveTeamFromGame: PropTypes.func.isRequired,
  handleToggleTeamOutOfCompetition: PropTypes.func.isRequired,
  handleRefreshTeamsModalData: PropTypes.func,
  currentUserRole: PropTypes.string,
  isReadOnly: PropTypes.bool,
}

GameTeamsModal.defaultProps = {
  selectedGame: null,
  selectedTeamToAdd: '',
  handleRefreshTeamsModalData: undefined,
  currentUserRole: null,
}

export default memo(GameTeamsModal)
