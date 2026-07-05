import { memo } from 'react'
import PropTypes from 'prop-types'

import Modal from '@components/Modal'
import AmountStepperInput, {
  DEFAULT_MONEY_INPUT_CLASS_NAME,
} from '@components/cabinet/AmountStepperInput'
import CabinetButton from '@components/cabinet/CabinetButton'
import CabinetInputField from '@components/cabinet/CabinetInputField'
import CabinetNumberField from '@components/cabinet/CabinetNumberField'
import NeonCheckbox from '@components/NeonCheckbox'
import ModalSection from '@components/modals/ModalSection'

import GameBasicInfoSection from './sections/GameBasicInfoSection'
import GameModeratorsSection from './sections/GameModeratorsSection'
import GameSettingsSection from './sections/GameSettingsSection'
import TaskDistributionSection from './sections/TaskDistributionSection'

const fieldLabelClassName =
  'text-sm font-semibold text-slate-700 dark:text-white'
const fieldInputClassName =
  'w-full px-4 py-3 text-sm border border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900/70 dark:text-white rounded-xl focus:border-primary focus:outline-none'
const amountInputClassName = DEFAULT_MONEY_INPUT_CLASS_NAME

const getCheckboxChecked = (valueOrEvent) =>
  typeof valueOrEvent === 'boolean'
    ? valueOrEvent
    : Boolean(valueOrEvent?.target?.checked)

const debugCheckboxUpdate = (source, checked, payloadFactory) => {
  try {
    const payload =
      typeof payloadFactory === 'function'
        ? payloadFactory(checked)
        : payloadFactory
    return payload
  } catch (error) {
    console.error('[GameEditModal] Ошибка обновления чекбокса', {
      source,
      checked,
      error,
    })
    return null
  }
}

const GameEditModal = ({
  selectedGame,
  isEditModalOpen,
  handleCloseEditModal,
  canEditSelectedGame,
  isSaving,
  location,
  isDirty,
  handleModalPrimaryAction,
  handleResetChanges,
  updateSelectedGame,
  GAME_TYPE_OPTIONS,
  CLUE_EARLY_MODE_OPTIONS,
  canGenerateResults,
  isGeneratingResults,
  handleGenerateResults,
  generateResultsButtonLabel,
  selectedGameModerators,
  availableModeratorsForSelect,
  availableModeratorsMap,
  availableOrganizersForSelect,
  selectedModeratorToAdd,
  setSelectedModeratorToAdd,
  handleAddModerator,
  handleRemoveModerator,
  selectedGameAgents,
  availableAgentsForSelect,
  availableAgentsMap,
  selectedAgentToAdd,
  setSelectedAgentToAdd,
  handleAddAgent,
  handleRemoveAgent,
  editGameLocationOptions,
  editGameSeasons,
  isEditGameSeasonsLoading,
  isEditGameSeasonCreating,
  handleCreateSeasonForEditGame,
  handleAddPrice,
  handlePriceChange,
  handleRemovePrice,
  canViewCodePhotos,
}) => {
  const isClosedGame =
    String(selectedGame?.status || '').toLowerCase() === 'closed'
  const showTasksAudience =
    selectedGame?.showTasksAudience === 'participants' ? 'participants' : 'all'
  const renderShowTasksAudienceToggle = (idPrefix) => {
    if (!Boolean(selectedGame?.showTasks)) {
      return null
    }

    const options = [
      { value: 'all', label: 'Показывать всем' },
      { value: 'participants', label: 'Показывать только участникам игры' },
    ]

    return (
      <div
        className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-900/70"
        role="radiogroup"
        aria-label="Доступ к заданиям после завершения"
      >
        {options.map((option) => {
          const isSelected = showTasksAudience === option.value
          return (
            <button
              key={option.value}
              id={`${idPrefix}-${option.value}`}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() =>
                updateSelectedGame({ showTasksAudience: option.value })
              }
              className={`min-h-10 flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                isSelected
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
                  : 'text-slate-600 hover:bg-white/70 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    )
  }

  if (!selectedGame) {
    return (
      <Modal
        isOpen={isEditModalOpen}
        title="Редактирование игры"
        onClose={handleCloseEditModal}
      >
        <p className="text-sm text-slate-500 dark:text-slate-300">
          Игра не выбрана. Закройте окно и выберите игру снова.
        </p>
      </Modal>
    )
  }

  if (isClosedGame) {
    const closedModalFooter = (
      <>
        <CabinetButton
          onClick={handleModalPrimaryAction}
          disabled={
            isSaving || (isDirty && (!canEditSelectedGame || !location))
          }
          variant="primary"
        >
          {isDirty
            ? isSaving
              ? 'Сохранение…'
              : 'Сохранить и закрыть'
            : 'Закрыть'}
        </CabinetButton>
        {isDirty && (
          <CabinetButton
            onClick={handleResetChanges}
            disabled={!canEditSelectedGame}
            variant="secondary"
          >
            Отменить изменения
          </CabinetButton>
        )}
      </>
    )

    return (
      <Modal
        isOpen={isEditModalOpen}
        title={`Редактирование игры «${selectedGame?.name || 'Без названия'}»`}
        onClose={handleCloseEditModal}
        footer={closedModalFooter}
      >
        <fieldset
          disabled={!canEditSelectedGame || isSaving}
          className="p-0 m-0 space-y-4 border-0"
        >
          <ModalSection>
            <p className="text-sm text-slate-500 dark:text-slate-300">
              Для закрытой игры можно менять только параметры публикации.
            </p>
            <div className="grid gap-3 mt-4">
              <NeonCheckbox
                id="game-show-creator-closed"
                checked={Boolean(selectedGame.showCreator)}
                onChange={(eventOrChecked) => {
                  const payload = debugCheckboxUpdate(
                    'showCreator',
                    getCheckboxChecked(eventOrChecked),
                    (checked) => ({ showCreator: checked }),
                  )
                  if (payload) updateSelectedGame(payload)
                }}
                label="Показывать организатора игрокам"
                labelClassName="text-sm text-slate-600 dark:text-slate-200"
              />
              <NeonCheckbox
                id="game-show-tasks-closed"
                checked={Boolean(selectedGame.showTasks)}
                onChange={(eventOrChecked) => {
                  const payload = debugCheckboxUpdate(
                    'showTasks',
                    getCheckboxChecked(eventOrChecked),
                    (checked) => ({ showTasks: checked }),
                  )
                  if (payload) updateSelectedGame(payload)
                }}
                label="Открыть задания после завершения"
                labelClassName="text-sm text-slate-600 dark:text-slate-200"
              />
              {renderShowTasksAudienceToggle(
                'game-show-tasks-audience-closed',
              )}
              <NeonCheckbox
                id="game-show-tasks-count-in-game-closed"
                checked={Boolean(selectedGame.showTasksCountInGame)}
                onChange={(eventOrChecked) => {
                  const payload = debugCheckboxUpdate(
                    'showTasksCountInGame',
                    getCheckboxChecked(eventOrChecked),
                    (checked) => ({ showTasksCountInGame: checked }),
                  )
                  if (payload) updateSelectedGame(payload)
                }}
                label="Показывать количество заданий на игре"
                labelClassName="text-sm text-slate-600 dark:text-slate-200"
              />
              <NeonCheckbox
                id="game-hide-result-closed"
                checked={!Boolean(selectedGame.hideResult)}
                onChange={(eventOrChecked) => {
                  const payload = debugCheckboxUpdate(
                    'hideResult',
                    getCheckboxChecked(eventOrChecked),
                    (checked) => ({ hideResult: !checked }),
                  )
                  if (payload) updateSelectedGame(payload)
                }}
                label="Показать результаты"
                labelClassName="text-sm text-slate-600 dark:text-slate-200"
              />
            </div>
          </ModalSection>
        </fieldset>
      </Modal>
    )
  }

  const modalFooter = (
    <>
      <CabinetButton
        onClick={handleModalPrimaryAction}
        disabled={isSaving || (isDirty && (!canEditSelectedGame || !location))}
        variant="primary"
      >
        {isDirty
          ? isSaving
            ? 'Сохранение…'
            : 'Сохранить и закрыть'
          : 'Закрыть'}
      </CabinetButton>
      {isDirty && (
        <CabinetButton
          onClick={handleResetChanges}
          disabled={!canEditSelectedGame}
          variant="secondary"
        >
          Отменить изменения
        </CabinetButton>
      )}
    </>
  )

  return (
    <Modal
      isOpen={isEditModalOpen}
      title={`Редактирование игры «${selectedGame?.name || 'Без названия'}»`}
      onClose={handleCloseEditModal}
      footer={modalFooter}
    >
      <fieldset
        disabled={!canEditSelectedGame || isSaving}
        className="m-0 space-y-6 border-0 p-0 [&_button]:cursor-pointer [&_select]:cursor-pointer"
      >
        <GameBasicInfoSection
          selectedGame={selectedGame}
          canEditSelectedGame={canEditSelectedGame}
          isSaving={isSaving}
          updateSelectedGame={updateSelectedGame}
          GAME_TYPE_OPTIONS={GAME_TYPE_OPTIONS}
          editGameLocationOptions={editGameLocationOptions}
          availableOrganizersForSelect={availableOrganizersForSelect}
          debugCheckboxUpdate={(source, checked, factory) => {
            const payload = debugCheckboxUpdate(source, checked, factory)
            if (payload) updateSelectedGame(payload)
          }}
          getCheckboxChecked={getCheckboxChecked}
        />

        <GameSettingsSection
          selectedGame={selectedGame}
          canEditSelectedGame={canEditSelectedGame}
          isSaving={isSaving}
          updateSelectedGame={updateSelectedGame}
          CLUE_EARLY_MODE_OPTIONS={CLUE_EARLY_MODE_OPTIONS}
          debugCheckboxUpdate={(source, checked, factory) => {
            const payload = debugCheckboxUpdate(source, checked, factory)
            if (payload) updateSelectedGame(payload)
          }}
          getCheckboxChecked={getCheckboxChecked}
        />

        {selectedGame?.type !== 'story' ? (
          <TaskDistributionSection
            selectedGame={selectedGame}
            updateSelectedGame={updateSelectedGame}
            disabled={!canEditSelectedGame || isSaving}
          />
        ) : null}

        <GameModeratorsSection
          selectedGameModerators={selectedGameModerators}
          canEditSelectedGame={canEditSelectedGame}
          isSaving={isSaving}
          availableModeratorsForSelect={availableModeratorsForSelect}
          availableModeratorsMap={availableModeratorsMap}
          selectedModeratorToAdd={selectedModeratorToAdd}
          setSelectedModeratorToAdd={setSelectedModeratorToAdd}
          handleAddModerator={handleAddModerator}
          handleRemoveModerator={handleRemoveModerator}
          selectedGameAgents={selectedGameAgents}
          availableAgentsForSelect={availableAgentsForSelect}
          availableAgentsMap={availableAgentsMap}
          selectedAgentToAdd={selectedAgentToAdd}
          setSelectedAgentToAdd={setSelectedAgentToAdd}
          handleAddAgent={handleAddAgent}
          handleRemoveAgent={handleRemoveAgent}
          updateSelectedGame={updateSelectedGame}
          getCheckboxChecked={getCheckboxChecked}
        />

        <ModalSection>
          <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
            Публикация и результаты
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            <NeonCheckbox
              id="game-is-rated"
              checked={Boolean(selectedGame.isRated ?? true)}
              onChange={(eventOrChecked) => {
                const payload = debugCheckboxUpdate(
                  'isRated',
                  getCheckboxChecked(eventOrChecked),
                  (checked) =>
                    checked
                      ? { isRated: true, hidden: false }
                      : { isRated: false },
                )
                if (payload) updateSelectedGame(payload)
              }}
              label="Рейтинговая игра"
              labelClassName="text-sm text-slate-600 dark:text-slate-200"
            />
            <NeonCheckbox
              id="game-hidden"
              checked={Boolean(selectedGame.hidden)}
              disabled={Boolean(selectedGame.isRated ?? true)}
              onChange={(eventOrChecked) => {
                const payload = debugCheckboxUpdate(
                  'hidden',
                  getCheckboxChecked(eventOrChecked),
                  (checked) => ({ hidden: checked }),
                )
                if (payload) updateSelectedGame(payload)
              }}
              label="Игра скрыта из общего списка"
              labelClassName="text-sm text-slate-600 dark:text-slate-200"
            />
            <NeonCheckbox
              id="game-show-creator"
              checked={Boolean(selectedGame.showCreator)}
              onChange={(eventOrChecked) => {
                const payload = debugCheckboxUpdate(
                  'showCreator',
                  getCheckboxChecked(eventOrChecked),
                  (checked) => ({ showCreator: checked }),
                )
                if (payload) updateSelectedGame(payload)
              }}
              label="Показывать организатора игрокам"
              labelClassName="text-sm text-slate-600 dark:text-slate-200"
            />
            <NeonCheckbox
              id="game-show-tasks"
              checked={Boolean(selectedGame.showTasks)}
              onChange={(eventOrChecked) => {
                const payload = debugCheckboxUpdate(
                  'showTasks',
                  getCheckboxChecked(eventOrChecked),
                  (checked) => ({ showTasks: checked }),
                )
                if (payload) updateSelectedGame(payload)
              }}
              label="Открыть задания после завершения"
              labelClassName="text-sm text-slate-600 dark:text-slate-200"
            />
            {renderShowTasksAudienceToggle('game-show-tasks-audience')}
            <NeonCheckbox
              id="game-show-tasks-count-in-game"
              checked={Boolean(selectedGame.showTasksCountInGame)}
              onChange={(eventOrChecked) => {
                const payload = debugCheckboxUpdate(
                  'showTasksCountInGame',
                  getCheckboxChecked(eventOrChecked),
                  (checked) => ({ showTasksCountInGame: checked }),
                )
                if (payload) updateSelectedGame(payload)
              }}
              label="Показывать количество заданий на игре"
              labelClassName="text-sm text-slate-600 dark:text-slate-200"
            />
            <NeonCheckbox
              id="game-hide-result"
              checked={!Boolean(selectedGame.hideResult)}
              onChange={(eventOrChecked) => {
                const payload = debugCheckboxUpdate(
                  'hideResult',
                  getCheckboxChecked(eventOrChecked),
                  (checked) => ({ hideResult: !checked }),
                )
                if (payload) updateSelectedGame(payload)
              }}
              label="Показать результаты"
              labelClassName="text-sm text-slate-600 dark:text-slate-200"
            />
            {!isClosedGame && (
              <NeonCheckbox
                id="game-registration-open"
                checked={Boolean(selectedGame.registrationOpen ?? true)}
                onChange={(eventOrChecked) => {
                  const payload = debugCheckboxUpdate(
                    'registrationOpen',
                    getCheckboxChecked(eventOrChecked),
                    (checked) => ({ registrationOpen: checked }),
                  )
                  if (payload) updateSelectedGame(payload)
                }}
                label="Запись на игру открыта"
                labelClassName="text-sm text-slate-600 dark:text-slate-200"
              />
            )}
            {!isClosedGame && (
              <NeonCheckbox
                id="game-show-enter-button"
                checked={Boolean(selectedGame.showEnterButton)}
                onChange={(eventOrChecked) => {
                  const payload = debugCheckboxUpdate(
                    'showEnterButton',
                    getCheckboxChecked(eventOrChecked),
                    (checked) => ({ showEnterButton: checked }),
                  )
                  if (payload) updateSelectedGame(payload)
                }}
                label="Показывать кнопку «Зайти в игру» до запуска"
                labelClassName="text-sm text-slate-600 dark:text-slate-200"
              />
            )}
          </div>
          <div className="p-3 mt-3 border rounded-2xl border-slate-200 dark:border-slate-700">
            <NeonCheckbox
              id="game-max-team-players-unlimited"
              checked={selectedGame.maxTeamPlayers === null}
              onChange={(eventOrChecked) => {
                const payload = debugCheckboxUpdate(
                  'maxTeamPlayers',
                  getCheckboxChecked(eventOrChecked),
                  (checked) => ({
                    maxTeamPlayers: checked
                      ? null
                      : Number(selectedGame.maxTeamPlayers) > 0
                        ? Number(selectedGame.maxTeamPlayers)
                        : 4,
                  }),
                )
                if (payload) updateSelectedGame(payload)
              }}
              label="Размер команды: без ограничений"
              labelClassName="text-sm text-slate-600 dark:text-slate-200"
            />
            {selectedGame.maxTeamPlayers !== null ? (
              <div className="mt-3">
                <CabinetNumberField
                  id="game-max-team-players"
                  label="Максимум игроков в команде"
                  min={1}
                  step={1}
                  value={Number(selectedGame.maxTeamPlayers) || ''}
                  onChange={(event) =>
                    updateSelectedGame({
                      maxTeamPlayers:
                        event.target.value === ''
                          ? null
                          : Math.max(1, Number(event.target.value) || 1),
                    })
                  }
                  labelClassName={fieldLabelClassName}
                  inputClassName={fieldInputClassName}
                  placeholder="Например, 4"
                />
              </div>
            ) : null}
          </div>
          {Boolean(selectedGame.isRated ?? true) && (
            <div className="p-4 mt-3 border rounded-2xl border-slate-200 dark:border-slate-700">
              <label
                htmlFor="game-season"
                className="block text-sm font-semibold text-slate-700 dark:text-slate-100"
              >
                Сезон
              </label>
              <div className="flex flex-col gap-2 mt-2 sm:flex-row">
                <select
                  id="game-season"
                  value={
                    typeof selectedGame.seasonId === 'string'
                      ? selectedGame.seasonId
                      : ''
                  }
                  onChange={(event) => {
                    const seasonId = event.target.value
                    const selectedSeason = Array.isArray(editGameSeasons)
                      ? editGameSeasons.find((s) => s.id === seasonId)
                      : null
                    updateSelectedGame({
                      seasonId,
                      seasonName: selectedSeason?.name || '',
                    })
                  }}
                  disabled={
                    isEditGameSeasonsLoading || !canEditSelectedGame || isSaving
                  }
                  className="w-full px-3 py-2 text-sm border rounded-xl border-slate-200 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200"
                >
                  <option value="">
                    {isEditGameSeasonsLoading
                      ? 'Загружаем сезоны…'
                      : 'Вне сезона'}
                  </option>
                  {Array.isArray(editGameSeasons) &&
                    editGameSeasons.map((season) => (
                      <option key={season.id} value={season.id}>
                        {season.name}
                      </option>
                    ))}
                </select>
                <CabinetButton
                  onClick={handleCreateSeasonForEditGame}
                  disabled={
                    !canEditSelectedGame || isEditGameSeasonCreating || isSaving
                  }
                  variant="secondary"
                  tone="brand"
                  size="sm"
                >
                  {isEditGameSeasonCreating ? 'Создание…' : 'Создать сезон'}
                </CabinetButton>
              </div>
            </div>
          )}
          <div className="pt-2">
            <CabinetButton
              onClick={handleGenerateResults}
              disabled={!canGenerateResults || isGeneratingResults}
              variant="soft"
              tone="cyan"
              size="md"
            >
              {generateResultsButtonLabel}
            </CabinetButton>
            {!canGenerateResults && (
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-300">
                Доступно только для завершённых или закрытых игр.
              </p>
            )}
          </div>
        </ModalSection>

        <ModalSection>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
              Стоимость участия
            </h2>
            <CabinetButton onClick={handleAddPrice} variant="primary" size="sm">
              Добавить тариф
            </CabinetButton>
          </div>
          {(selectedGame.prices ?? []).length > 0 ? (
            <div className="space-y-3">
              {selectedGame.prices.map((price) => (
                <div
                  key={price.id}
                  className="grid gap-3 md:grid-cols-[2fr_1fr_auto] items-center p-4 border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/50 rounded-2xl"
                >
                  <CabinetInputField
                    id={`game-price-name-${price.id}`}
                    label={null}
                    type="text"
                    value={price.name}
                    onChange={(event) =>
                      handlePriceChange(price.id, 'name', event.target.value)
                    }
                    placeholder="Название тарифа"
                    containerClassName="space-y-0 w-full"
                    inputClassName="w-full px-4 py-2 text-sm border border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900/70 dark:text-white rounded-xl focus:border-primary focus:outline-none"
                  />
                  <AmountStepperInput
                    value={price.price}
                    min={0}
                    step={100}
                    placeholder="Стоимость"
                    className="max-w-none"
                    inputClassName={amountInputClassName}
                    onChange={(nextValue) =>
                      handlePriceChange(price.id, 'price', nextValue)
                    }
                  />
                  <CabinetButton
                    onClick={() => handleRemovePrice(price.id)}
                    variant="secondary"
                    tone="danger"
                    size="sm"
                  >
                    Удалить
                  </CabinetButton>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-200">
              Добавьте тариф, чтобы задать стоимость участия для команд.
            </p>
          )}
        </ModalSection>
      </fieldset>
    </Modal>
  )
}

GameEditModal.propTypes = {
  selectedGame: PropTypes.shape({
    id: PropTypes.string,
    showTasks: PropTypes.bool,
    showTasksAudience: PropTypes.oneOf(['all', 'participants']),
    showTasksCountInGame: PropTypes.bool,
  }),
  isEditModalOpen: PropTypes.bool.isRequired,
  handleCloseEditModal: PropTypes.func.isRequired,
  canEditSelectedGame: PropTypes.bool.isRequired,
  isSaving: PropTypes.bool.isRequired,
  location: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.shape({ city: PropTypes.string }),
  ]),
  isDirty: PropTypes.bool.isRequired,
  handleModalPrimaryAction: PropTypes.func.isRequired,
  handleResetChanges: PropTypes.func.isRequired,
  updateSelectedGame: PropTypes.func.isRequired,
  GAME_TYPE_OPTIONS: PropTypes.array.isRequired,
  CLUE_EARLY_MODE_OPTIONS: PropTypes.array.isRequired,
  canGenerateResults: PropTypes.bool.isRequired,
  isGeneratingResults: PropTypes.bool.isRequired,
  handleGenerateResults: PropTypes.func.isRequired,
  generateResultsButtonLabel: PropTypes.string.isRequired,
  selectedGameModerators: PropTypes.array.isRequired,
  availableModeratorsForSelect: PropTypes.array.isRequired,
  availableModeratorsMap: PropTypes.instanceOf(Map).isRequired,
  availableOrganizersForSelect: PropTypes.array.isRequired,
  selectedModeratorToAdd: PropTypes.string.isRequired,
  setSelectedModeratorToAdd: PropTypes.func.isRequired,
  handleAddModerator: PropTypes.func.isRequired,
  handleRemoveModerator: PropTypes.func.isRequired,
  selectedGameAgents: PropTypes.array.isRequired,
  availableAgentsForSelect: PropTypes.array.isRequired,
  availableAgentsMap: PropTypes.instanceOf(Map).isRequired,
  selectedAgentToAdd: PropTypes.string.isRequired,
  setSelectedAgentToAdd: PropTypes.func.isRequired,
  handleAddAgent: PropTypes.func.isRequired,
  handleRemoveAgent: PropTypes.func.isRequired,
  editGameLocationOptions: PropTypes.array,
  editGameSeasons: PropTypes.array,
  isEditGameSeasonsLoading: PropTypes.bool,
  isEditGameSeasonCreating: PropTypes.bool,
  handleCreateSeasonForEditGame: PropTypes.func.isRequired,
  handleAddPrice: PropTypes.func.isRequired,
  handlePriceChange: PropTypes.func.isRequired,
  handleRemovePrice: PropTypes.func.isRequired,
  canViewCodePhotos: PropTypes.bool,
}

GameEditModal.defaultProps = {
  selectedGame: null,
  location: null,
  editGameLocationOptions: [],
  editGameSeasons: [],
  isEditGameSeasonsLoading: false,
  isEditGameSeasonCreating: false,
  canViewCodePhotos: false,
}

export default memo(GameEditModal)
