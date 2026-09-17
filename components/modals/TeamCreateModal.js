import { memo } from 'react'
import PropTypes from 'prop-types'

import Modal from '@components/Modal'
import CabinetButton from '@components/cabinet/CabinetButton'
import CabinetInputField from '@components/cabinet/CabinetInputField'
import CabinetSelectField from '@components/cabinet/CabinetSelectField'
import CabinetTextareaField from '@components/cabinet/CabinetTextareaField'
import ImagesInput from '@components/cabinet/ImagesInput'

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
  newTeamJoinPolicy,
  onChangeNewTeamJoinPolicy,
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
      <CabinetSelectField
        id="new-team-join-policy"
        label="Вступление в команду"
        value={newTeamJoinPolicy}
        onChange={(event) => onChangeNewTeamJoinPolicy(event.target.value)}
        selectClassName="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-900/60"
      >
        <option value="open">Открытая — вступление без подтверждения</option>
        <option value="request">По заявке — подтверждает капитан</option>
        <option value="closed">Закрытая — вступление запрещено</option>
      </CabinetSelectField>
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
  newTeamJoinPolicy: PropTypes.oneOf(['open', 'request', 'closed']).isRequired,
  onChangeNewTeamJoinPolicy: PropTypes.func.isRequired,
  onCreateTeam: PropTypes.func.isRequired,
}

export default memo(TeamCreateModal)
