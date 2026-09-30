import PropTypes from 'prop-types'
import { showClassicItemsAndVariants } from '@helpers/classicEditorSettings'

import Modal from '@components/Modal'
import CabinetButton from '@components/cabinet/CabinetButton'
import ModalSection from '@components/modals/ModalSection'
import NeonCheckbox from '@components/NeonCheckbox'
import { TASK_THEMES, normalizeTaskTheme } from '@helpers/taskThemes'

import TaskDistributionSection from './sections/TaskDistributionSection'

const handleCustomTaskPublicTitlesChange = (updateSelectedGame, eventOrChecked) => {
  const checked =
    typeof eventOrChecked === 'boolean'
      ? eventOrChecked
      : Boolean(eventOrChecked?.target?.checked)

  updateSelectedGame((game) => ({
    useCustomTaskPublicTitles: checked,
    tasks: checked
      ? (game.tasks || []).map((task, index) => ({
          ...task,
          publicTitle:
            typeof task?.publicTitle === 'string' && task.publicTitle.trim()
              ? task.publicTitle
              : `${index + 1} Задание`,
        }))
      : game.tasks || [],
  }))
}

const GameTaskSettingsModal = ({
  selectedGame,
  canManageClassic,
  isOpen,
  onClose,
  canEditSelectedGame,
  isGameClosed,
  isSaving,
  isDirty,
  location,
  onSave,
  updateSelectedGame,
}) => (
  <Modal
    isOpen={isOpen}
    title={`Настройки заданий «${selectedGame.name || 'Без названия'}»`}
    onClose={onClose}
    footer={
      <>
        <CabinetButton onClick={onClose} disabled={isSaving} variant="secondary">
          К заданиям
        </CabinetButton>
        {isDirty ? (
          <CabinetButton
            onClick={onSave}
            disabled={isSaving || !canEditSelectedGame || !location}
            variant="primary"
          >
            {isSaving ? 'Сохранение…' : 'Сохранить'}
          </CabinetButton>
        ) : null}
      </>
    }
  >
    <fieldset
      disabled={isSaving}
      className="m-0 border-0 p-0 [&_button]:cursor-pointer [&_select]:cursor-pointer"
    >
      <ModalSection>
        <div className="space-y-2">
          <label
            className="text-sm font-semibold text-slate-700 dark:text-white"
            htmlFor="game-task-theme"
          >
            Оформление всех заданий
          </label>
          <select
            id="game-task-theme"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-900/70 dark:text-white"
            value={normalizeTaskTheme(selectedGame.taskTheme)}
            disabled={!canEditSelectedGame || isGameClosed || isSaving}
            onChange={(event) =>
              updateSelectedGame({ taskTheme: event.target.value })
            }
          >
            {TASK_THEMES.map((theme) => (
              <option key={theme.id} value={theme.id}>
                {theme.label}
              </option>
            ))}
          </select>
          <p className="text-sm text-slate-500 dark:text-slate-300">
            Единая тема для всех заданий игры, включая новые задания, варианты,
            подсказки и сообщения после выполнения. Не зависит от темы интерфейса
            игрока. Авторские цвета текста и выделения сохраняются. Проверьте их
            сочетание с фоном в предпросмотре.
          </p>
        </div>
        {canManageClassic && selectedGame.type === 'classic' && (
          <NeonCheckbox
            id={`game-items-and-variants-${selectedGame.id}`}
            checked={showClassicItemsAndVariants(selectedGame)}
            onChange={(event) => updateSelectedGame({ classicItemsAndVariantsEnabled: event.target.checked })}
            disabled={!canEditSelectedGame || isGameClosed || isSaving}
            label="Предметы и вариативность заданий"
            description="Показывать предметы, варианты заданий и награды в редакторе. При отключении их настройки сохраняются."
            labelClassName="text-sm text-slate-600 dark:text-slate-200"
          />
        )}
        {['classic', 'photo'].includes(selectedGame.type) ? (
          <NeonCheckbox
            id={`game-custom-task-public-titles-${selectedGame.id}`}
            checked={Boolean(selectedGame.useCustomTaskPublicTitles)}
            onChange={(eventOrChecked) =>
              handleCustomTaskPublicTitlesChange(
                updateSelectedGame,
                eventOrChecked,
              )
            }
            disabled={!canEditSelectedGame || isSaving}
            label="Произвольные публичные названия"
            labelClassName="text-sm text-slate-600 dark:text-slate-200"
          />
        ) : null}
        {selectedGame.type !== 'story' ? (
          <TaskDistributionSection
            selectedGame={selectedGame}
            updateSelectedGame={updateSelectedGame}
            disabled={!canEditSelectedGame || isSaving}
          />
        ) : null}
      </ModalSection>
    </fieldset>
  </Modal>
)

GameTaskSettingsModal.propTypes = {
  canManageClassic: PropTypes.bool.isRequired,
  selectedGame: PropTypes.shape({
    id: PropTypes.string,
    name: PropTypes.string,
    type: PropTypes.string,
    taskTheme: PropTypes.string,
    classicItemsAndVariantsEnabled: PropTypes.bool,
    classicItems: PropTypes.array,
    useCustomTaskPublicTitles: PropTypes.bool,
    taskDistributionMode: PropTypes.oneOf(['linear', 'random']),
    taskDistributionTemplate: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.number)),
    tasks: PropTypes.array,
  }).isRequired,
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  canEditSelectedGame: PropTypes.bool.isRequired,
  isGameClosed: PropTypes.bool.isRequired,
  isSaving: PropTypes.bool.isRequired,
  isDirty: PropTypes.bool.isRequired,
  location: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.shape({ city: PropTypes.string }),
  ]),
  onSave: PropTypes.func.isRequired,
  updateSelectedGame: PropTypes.func.isRequired,
}

GameTaskSettingsModal.defaultProps = {
  location: null,
}

export default GameTaskSettingsModal
