import { memo } from 'react'
import PropTypes from 'prop-types'

import Modal from '@components/Modal'
import CabinetInputField from '@components/cabinet/CabinetInputField'
import NoticeBanner from '@components/NoticeBanner'

const TeamJoinModal = ({
  isOpen,
  onClose,
  isJoiningTeam,
  isJoinActionDisabled,
  joinTeamId,
  onChangeJoinTeamId,
  onJoinTeam,
  canUseSelfServiceTeams,
}) => (
  <Modal
    isOpen={isOpen}
    title="Подать заявку в команду"
    onClose={onClose}
    footer={(
      <>
        <button
          type="button"
          onClick={onClose}
          disabled={isJoiningTeam}
          className="aq-modal-btn aq-modal-btn-secondary"
        >
          Отмена
        </button>
        <button
          type="button"
          onClick={onJoinTeam}
          disabled={isJoinActionDisabled}
          className="aq-modal-btn aq-modal-btn-primary"
        >
          {isJoiningTeam ? 'Отправка…' : 'Подать заявку'}
        </button>
      </>
    )}
  >
    <fieldset disabled={isJoiningTeam} className="m-0 space-y-5 border-0 p-0">
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Введите идентификатор открытой команды. Капитан увидит заявку и решит, принять ли вас в состав.
      </p>
      <CabinetInputField
        id="join-team-id"
        label="ID команды"
        value={joinTeamId}
        onChange={(event) => onChangeJoinTeamId(event.target.value)}
        placeholder="Например, 64ff0c2e12"
        inputClassName="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm uppercase tracking-wide focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-900/60"
      />
      {!canUseSelfServiceTeams ? (
        <NoticeBanner tone="warning" variant="neon">
          Заполните профиль, чтобы подавать заявки в команды.
        </NoticeBanner>
      ) : null}
    </fieldset>
  </Modal>
)

TeamJoinModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  isJoiningTeam: PropTypes.bool.isRequired,
  isJoinActionDisabled: PropTypes.bool.isRequired,
  joinTeamId: PropTypes.string.isRequired,
  onChangeJoinTeamId: PropTypes.func.isRequired,
  onJoinTeam: PropTypes.func.isRequired,
  canUseSelfServiceTeams: PropTypes.bool.isRequired,
}

export default memo(TeamJoinModal)
