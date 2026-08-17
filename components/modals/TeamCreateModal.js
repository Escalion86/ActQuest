import { memo } from 'react'
import PropTypes from 'prop-types'

import Modal from '@components/Modal'
import CabinetButton from '@components/cabinet/CabinetButton'
import CabinetInputField from '@components/cabinet/CabinetInputField'
import CabinetTextareaField from '@components/cabinet/CabinetTextareaField'
import ImagesInput from '@components/cabinet/ImagesInput'
import NeonCheckbox from '@components/NeonCheckbox'

const TeamCreateModal = ({
  isOpen,
  onClose,
  isCreatingTeam,
  isCreateActionDisabled,
  newTeamName,
  onChangeNewTeamName,
  newTeamDescription,
  onChangeNewTeamDescription,
  newTeamImage,
  onChangeNewTeamImage,
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
        <CabinetButton
          onClick={onClose}
          disabled={isCreatingTeam}
          variant="secondary"
        >
          Отмена
        </CabinetButton>
        <CabinetButton
          onClick={onCreateTeam}
          disabled={isCreateActionDisabled}
          variant="primary"
        >
          {isCreatingTeam ? 'Создание…' : 'Создать команду'}
        </CabinetButton>
      </>
    )}
  >
    <fieldset disabled={isCreatingTeam} className="m-0 space-y-5 border-0 p-0">
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Название команды можно изменить позже. Вы автоматически станете капитаном созданной команды.
      </p>
      <CabinetInputField
        id="new-team-name"
        label="Название команды"
        value={newTeamName}
        onChange={(event) => onChangeNewTeamName(event.target.value)}
        placeholder="Например, Стремительные"
        inputClassName="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-900/60"
      />
      <CabinetTextareaField
        id="new-team-description"
        label="Краткое описание (по желанию)"
        value={newTeamDescription}
        onChange={(event) => onChangeNewTeamDescription(event.target.value)}
        rows={4}
        placeholder="Расскажите, для кого эта команда"
        textareaClassName="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-900/60"
      />
      <ImagesInput
        images={newTeamImage ? [newTeamImage] : []}
        onChange={(next) => onChangeNewTeamImage(Array.isArray(next) ? next[0] ?? '' : '')}
        directory="teams/draft"
        imageName="avatar"
        label="Аватарка команды"
        maxImages={1}
        disabled={isCreatingTeam}
        previewShape="circle"
      />
      <NeonCheckbox
        id="new-team-open"
        checked={newTeamOpen}
        onChange={(event) => onChangeNewTeamOpen(event.target.checked)}
        className="items-start"
        label="Открыть команду для заявок"
        labelClassName="text-sm font-semibold text-slate-700 dark:text-slate-100"
        description="Новые команды закрыты по умолчанию. Если открыть набор, игроки смогут отправлять капитану заявки по ID команды."
        descriptionClassName="text-xs text-slate-500 dark:text-slate-300"
      />
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
  newTeamImage: PropTypes.string.isRequired,
  onChangeNewTeamImage: PropTypes.func.isRequired,
  newTeamOpen: PropTypes.bool.isRequired,
  onChangeNewTeamOpen: PropTypes.func.isRequired,
  onCreateTeam: PropTypes.func.isRequired,
}

export default memo(TeamCreateModal)
