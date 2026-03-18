import { memo } from 'react'
import PropTypes from 'prop-types'

import Modal from '@components/Modal'

const TeamCreateModal = ({
  isOpen,
  onClose,
  isCreatingTeam,
  isCreateActionDisabled,
  newTeamName,
  onChangeNewTeamName,
  newTeamDescription,
  onChangeNewTeamDescription,
  newTeamOpen,
  onChangeNewTeamOpen,
  onCreateTeam,
}) => (
  <Modal
    isOpen={isOpen}
    title="Создание команды"
    onClose={onClose}
    footer={(
      <>
        <button
          type="button"
          onClick={onClose}
          disabled={isCreatingTeam}
          className="aq-modal-btn aq-modal-btn-secondary"
        >
          Отмена
        </button>
        <button
          type="button"
          onClick={onCreateTeam}
          disabled={isCreateActionDisabled}
          className="aq-modal-btn aq-modal-btn-primary"
        >
          {isCreatingTeam ? 'Создание…' : 'Создать команду'}
        </button>
      </>
    )}
  >
    <fieldset disabled={isCreatingTeam} className="m-0 space-y-5 border-0 p-0">
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Название команды можно изменить позже. Вы автоматически станете капитаном созданной команды.
      </p>
      <div className="space-y-2">
        <label htmlFor="new-team-name" className="text-sm font-semibold text-primary">
          Название команды
        </label>
        <input
          id="new-team-name"
          type="text"
          value={newTeamName}
          onChange={(event) => onChangeNewTeamName(event.target.value)}
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-900/60"
          placeholder="Например, Стремительные"
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="new-team-description" className="text-sm font-semibold text-primary">
          Краткое описание (по желанию)
        </label>
        <textarea
          id="new-team-description"
          value={newTeamDescription}
          onChange={(event) => onChangeNewTeamDescription(event.target.value)}
          rows={4}
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-900/60"
          placeholder="Расскажите, для кого эта команда"
        />
      </div>
      <div className="flex items-start gap-3">
        <input
          id="new-team-open"
          type="checkbox"
          checked={newTeamOpen}
          onChange={(event) => onChangeNewTeamOpen(event.target.checked)}
          className="mt-1 h-4 w-4 rounded border-slate-300 text-primary"
        />
        <div className="space-y-1">
          <label htmlFor="new-team-open" className="text-sm font-semibold text-primary">
            Разрешить присоединяться по id
          </label>
          <p className="text-xs text-slate-500 dark:text-slate-300">
            Когда настройка включена, новые участники смогут вступить в команду, введя её id в личном кабинете.
          </p>
        </div>
      </div>
    </fieldset>
  </Modal>
)

TeamCreateModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  isCreatingTeam: PropTypes.bool.isRequired,
  isCreateActionDisabled: PropTypes.bool.isRequired,
  newTeamName: PropTypes.string.isRequired,
  onChangeNewTeamName: PropTypes.func.isRequired,
  newTeamDescription: PropTypes.string.isRequired,
  onChangeNewTeamDescription: PropTypes.func.isRequired,
  newTeamOpen: PropTypes.bool.isRequired,
  onChangeNewTeamOpen: PropTypes.func.isRequired,
  onCreateTeam: PropTypes.func.isRequired,
}

export default memo(TeamCreateModal)
