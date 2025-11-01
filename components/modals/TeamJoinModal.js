import { memo } from 'react'
import PropTypes from 'prop-types'

import Modal from '@components/Modal'

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
    title="Присоединиться к команде"
    onClose={onClose}
    footer={(
      <>
        <button
          type="button"
          onClick={onClose}
          disabled={isJoiningTeam}
          className={`inline-flex justify-center rounded-xl border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
            isJoiningTeam
              ? 'border-slate-200 text-slate-400 dark:border-slate-700 dark:text-slate-500'
              : 'border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
          }`}
        >
          Отмена
        </button>
        <button
          type="button"
          onClick={onJoinTeam}
          disabled={isJoinActionDisabled}
          className={`inline-flex justify-center rounded-xl px-4 py-2 text-sm font-semibold text-white transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-60 ${
            isJoinActionDisabled
              ? 'bg-slate-400'
              : 'bg-primary hover:bg-blue-700'
          }`}
        >
          {isJoiningTeam ? 'Отправка…' : 'Вступить в команду'}
        </button>
      </>
    )}
  >
    <fieldset disabled={isJoiningTeam} className="m-0 space-y-5 border-0 p-0">
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Введите идентификатор команды. Его можно получить у капитана, если в настройках команды разрешено присоединение по id.
      </p>
      <div className="space-y-2">
        <label htmlFor="join-team-id" className="text-sm font-semibold text-primary">
          ID команды
        </label>
        <input
          id="join-team-id"
          type="text"
          value={joinTeamId}
          onChange={(event) => onChangeJoinTeamId(event.target.value)}
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm uppercase tracking-wide focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-900/60"
          placeholder="Например, 64ff0c2e12"
        />
      </div>
      {!canUseSelfServiceTeams ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
          Укажите площадку в профиле и привяжите Telegram, чтобы присоединяться к командам.
        </div>
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
