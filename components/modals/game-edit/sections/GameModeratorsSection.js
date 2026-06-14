import { memo } from 'react'
import PropTypes from 'prop-types'

import CabinetButton from '@components/cabinet/CabinetButton'
import CabinetSelectField from '@components/cabinet/CabinetSelectField'
import NeonCheckbox from '@components/NeonCheckbox'
import ModalSection from '@components/modals/ModalSection'

const fieldLabelClassName =
  'text-sm font-semibold text-slate-700 dark:text-white'

const GameModeratorsSection = ({
  selectedGameModerators,
  canEditSelectedGame,
  availableModeratorsForSelect,
  availableModeratorsMap,
  selectedModeratorToAdd,
  setSelectedModeratorToAdd,
  handleAddModerator,
  handleRemoveModerator,
  selectedGameAgents,
  isSaving,
  availableAgentsForSelect,
  availableAgentsMap,
  selectedAgentToAdd,
  setSelectedAgentToAdd,
  handleAddAgent,
  handleRemoveAgent,
  updateSelectedGame,
  getCheckboxChecked,
}) => (
  <>
    {(selectedGameModerators.length > 0 || canEditSelectedGame) && (
      <ModalSection>
        <div className="p-4 border rounded-xl border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-white">
            Модераторы игры
          </h3>
          {selectedGameModerators.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {selectedGameModerators.map((moderator) => {
                const moderatorId =
                  typeof moderator === 'string' ? moderator : moderator.id
                const fallback =
                  typeof moderator === 'string'
                    ? availableModeratorsMap.get(moderator)
                    : null
                const name =
                  typeof moderator === 'string'
                    ? (fallback?.name ?? 'Без имени')
                    : moderator.name || 'Без имени'
                return (
                  <li
                    key={moderatorId}
                    className="flex items-center justify-between gap-3 px-3 py-2 bg-white border rounded-xl border-slate-200 dark:border-slate-700 dark:bg-slate-900/80"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-800 dark:text-white">
                        {name}
                      </p>
                    </div>
                    {canEditSelectedGame && (
                      <CabinetButton
                        onClick={() => handleRemoveModerator(moderatorId)}
                        variant="secondary"
                        tone="danger"
                        size="sm"
                        className="inline-flex items-center justify-center py-1"
                      >
                        Удалить
                      </CabinetButton>
                    )}
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-300">
              Модераторы пока не назначены.
            </p>
          )}

          {canEditSelectedGame && availableModeratorsForSelect.length > 0 && (
            <div className="flex flex-col gap-3 pt-4 mt-4 border-t border-slate-200 dark:border-slate-700">
              <p className={fieldLabelClassName}>Добавить модератора</p>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <CabinetSelectField
                  id="edit-game-moderator"
                  label={null}
                  value={selectedModeratorToAdd}
                  onChange={(event) =>
                    setSelectedModeratorToAdd(event.target.value)
                  }
                  containerClassName="w-full space-y-0"
                  selectClassName="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-800 focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-900/70 dark:text-white"
                >
                  <option value="">Выберите модератора</option>
                  {availableModeratorsForSelect.map((moderator) => (
                    <option key={moderator.id} value={moderator.id}>
                      {moderator.name || 'Без имени'}
                    </option>
                  ))}
                </CabinetSelectField>
                <CabinetButton
                  onClick={handleAddModerator}
                  disabled={!selectedModeratorToAdd}
                  variant="primary"
                  size="md"
                >
                  Добавить
                </CabinetButton>
              </div>
            </div>
          )}
        </div>
      </ModalSection>
    )}

    <ModalSection>
      <div className="p-4 border rounded-xl border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-white">
          Агенты игры
        </h3>

        {selectedGameAgents.length > 0 ? (
          <div className="grid gap-3 mt-3 sm:grid-cols-2">
            <NeonCheckbox
              id="agent-notify-previous-task"
              checked={Boolean(
                selectedGame.agentNotifications?.onPreviousTask ?? true,
              )}
              onChange={(eventOrChecked) =>
                updateSelectedGame({
                  agentNotifications: {
                    ...(selectedGame.agentNotifications || {}),
                    onPreviousTask: getCheckboxChecked(eventOrChecked),
                  },
                })
              }
              label="Уведомлять на предыдущем задании"
              labelClassName="text-sm text-slate-600 dark:text-slate-200"
            />
            <NeonCheckbox
              id="agent-notify-current-task"
              checked={Boolean(
                selectedGame.agentNotifications?.onCurrentTask ?? true,
              )}
              onChange={(eventOrChecked) =>
                updateSelectedGame({
                  agentNotifications: {
                    ...(selectedGame.agentNotifications || {}),
                    onCurrentTask: getCheckboxChecked(eventOrChecked),
                  },
                })
              }
              label="Уведомлять на задании агента"
              labelClassName="text-sm text-slate-600 dark:text-slate-200"
            />
            <NeonCheckbox
              id="agent-notify-task-completed"
              checked={Boolean(
                selectedGame.agentNotifications?.onTaskCompleted ?? false,
              )}
              onChange={(eventOrChecked) =>
                updateSelectedGame({
                  agentNotifications: {
                    ...(selectedGame.agentNotifications || {}),
                    onTaskCompleted: getCheckboxChecked(eventOrChecked),
                  },
                })
              }
              label="Уведомлять о прохождении задания"
              labelClassName="text-sm text-slate-600 dark:text-slate-200"
            />
            <NeonCheckbox
              id="agent-notify-all-passed"
              checked={Boolean(
                selectedGame.agentNotifications?.onAllTeamsPassed ?? true,
              )}
              onChange={(eventOrChecked) =>
                updateSelectedGame({
                  agentNotifications: {
                    ...(selectedGame.agentNotifications || {}),
                    onAllTeamsPassed: getCheckboxChecked(eventOrChecked),
                  },
                })
              }
              label="Уведомлять, когда все команды прошли"
              labelClassName="text-sm text-slate-600 dark:text-slate-200"
            />
          </div>
        ) : null}

        {selectedGameAgents.length > 0 ? (
          <ul className="mt-4 space-y-2">
            {selectedGameAgents.map((agent) => (
              <li
                key={agent.userId}
                className="flex items-center justify-between gap-3 px-3 py-2 bg-white border rounded-xl border-slate-200 dark:border-slate-700 dark:bg-slate-900/80"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-white">
                    {agent.name || 'Без имени'}
                  </p>
                </div>
                {canEditSelectedGame ? (
                  <CabinetButton
                    onClick={() => handleRemoveAgent(agent.userId)}
                    variant="secondary"
                    tone="danger"
                    size="sm"
                    className="inline-flex items-center justify-center py-1"
                  >
                    Удалить
                  </CabinetButton>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-300">
            Агенты пока не назначены.
          </p>
        )}

        {canEditSelectedGame && availableAgentsForSelect.length > 0 && (
          <div className="flex flex-col gap-3 pt-4 mt-4 border-t border-slate-200 dark:border-slate-700">
            <p className={fieldLabelClassName}>Добавить агента</p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <CabinetSelectField
                id="edit-game-agent"
                label={null}
                value={selectedAgentToAdd}
                onChange={(event) => setSelectedAgentToAdd(event.target.value)}
                containerClassName="w-full space-y-0"
                selectClassName="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-800 focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-900/70 dark:text-white"
              >
                <option value="">Выберите агента</option>
                {availableAgentsForSelect.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name || 'Без имени'}
                  </option>
                ))}
              </CabinetSelectField>
              <CabinetButton
                onClick={handleAddAgent}
                disabled={!selectedAgentToAdd}
                variant="primary"
                size="md"
              >
                Добавить
              </CabinetButton>
            </div>
          </div>
        )}
      </div>
    </ModalSection>
  </>
)

GameModeratorsSection.propTypes = {
  selectedGameModerators: PropTypes.array.isRequired,
  canEditSelectedGame: PropTypes.bool.isRequired,
  availableModeratorsForSelect: PropTypes.array.isRequired,
  availableModeratorsMap: PropTypes.instanceOf(Map).isRequired,
  selectedModeratorToAdd: PropTypes.string.isRequired,
  setSelectedModeratorToAdd: PropTypes.func.isRequired,
  handleAddModerator: PropTypes.func.isRequired,
  handleRemoveModerator: PropTypes.func.isRequired,
  selectedGameAgents: PropTypes.array.isRequired,
  isSaving: PropTypes.bool.isRequired,
  availableAgentsForSelect: PropTypes.array.isRequired,
  availableAgentsMap: PropTypes.instanceOf(Map).isRequired,
  selectedAgentToAdd: PropTypes.string.isRequired,
  setSelectedAgentToAdd: PropTypes.func.isRequired,
  handleAddAgent: PropTypes.func.isRequired,
  handleRemoveAgent: PropTypes.func.isRequired,
  updateSelectedGame: PropTypes.func.isRequired,
  getCheckboxChecked: PropTypes.func.isRequired,
}

export default memo(GameModeratorsSection)
