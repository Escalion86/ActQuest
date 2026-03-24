import { memo } from 'react'
import PropTypes from 'prop-types'

import Modal from '@components/Modal'
import CabinetButton from '@components/cabinet/CabinetButton'
import CabinetSelectField from '@components/cabinet/CabinetSelectField'
import FormSectionCard from '@components/cabinet/FormSectionCard'
import NoticeBanner from '@components/NoticeBanner'

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
}) => (
  <Modal
                    isOpen={isTeamsModalOpen}
                    title={`Команды игры «${selectedGame.name || 'Без названия'}»`}
                    onClose={handleCloseTeamsModal}
                  >
                    <div className="space-y-5">
                      {teamsModalState.error && (
                        <NoticeBanner tone="error" variant="neon">
                          {teamsModalState.error}
                        </NoticeBanner>
                      )}

                      <div className="space-y-4">
                        {teamsModalState.isLoading ? (
                          <p className="text-sm text-slate-500 dark:text-slate-300">Загружаем список команд…</p>
                        ) : teamsModalState.gameTeams.length > 0 ? (
                          <ul className="space-y-3">
                            {teamsModalState.gameTeams.map((team) => {
                              const isRemoving = removingTeamIds.includes(team.id)
                              return (
                                <li
                                  key={team.id}
                                  className="rounded-2xl border border-slate-200 bg-white p-4 text-sm dark:border-slate-700 dark:bg-slate-900/60"
                                >
                                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                    <div>
                                      <p className="aq-modal-item-title font-semibold">
                                        {team.teamName}
                                      </p>
                                      {team.teamDescription ? (
                                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">
                                          {team.teamDescription}
                                        </p>
                                      ) : null}
                                      <p className="mt-1 text-xs text-slate-400 dark:text-slate-300">
                                        ID команды: {team.teamId || '—'}
                                      </p>
                                    </div>
                                    <CabinetButton
                                      onClick={() => handleRemoveTeamFromGame(team.id)}
                                      disabled={isRemoving || teamsModalState.isLoading}
                                      variant="secondary"
                                      tone={isRemoving || teamsModalState.isLoading ? 'neutral' : 'danger'}
                                      size="sm"
                                      className="inline-flex justify-center"
                                    >
                                      {isRemoving ? 'Удаление…' : 'Удалить'}
                                    </CabinetButton>
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

                      <FormSectionCard className="bg-slate-50 p-4 dark:bg-slate-800/60">
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Добавить команду</h3>
                        {teamsModalState.availableTeams.length > 0 ? (
                          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                            <CabinetSelectField
                              id="game-team-to-add"
                              label={null}
                              value={selectedTeamToAdd}
                              onChange={(event) => setSelectedTeamToAdd(event.target.value)}
                              containerClassName="w-full space-y-0"
                              selectClassName="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-primary focus:outline-none dark:border-slate-700"
                            >
                              {teamsModalState.availableTeams.map((team) => {
                                const membersCount = Number.isFinite(team?.membersCount)
                                  ? team.membersCount
                                  : Array.isArray(team?.members)
                                  ? team.members.length
                                  : 0

                                return (
                                  <option key={team.id} value={team.id}>
                                    {`${team.name} (${membersCount})`}
                                  </option>
                                )
                              })}
                            </CabinetSelectField>
                            <CabinetButton
                              onClick={handleAddTeamToGame}
                              disabled={!selectedTeamToAdd || isAddingTeam || teamsModalState.isLoading}
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
                            Свободных команд не найдено. Создайте команду или освободите её от участия в игре.
                          </p>
                        )}
                      </FormSectionCard>
                    </div>
                  </Modal>
)

const teamShape = PropTypes.shape({
  id: PropTypes.string.isRequired,
  teamName: PropTypes.string,
  teamDescription: PropTypes.string,
  teamId: PropTypes.string,
})

const availableTeamShape = PropTypes.shape({
  id: PropTypes.string.isRequired,
  name: PropTypes.string,
  members: PropTypes.array,
  membersCount: PropTypes.number,
})

GameTeamsModal.propTypes = {
  selectedGame: PropTypes.shape({ name: PropTypes.string }).isRequired,
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
}

GameTeamsModal.defaultProps = {
  selectedTeamToAdd: '',
}

export default memo(GameTeamsModal)
