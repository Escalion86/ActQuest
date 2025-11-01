import { memo } from 'react'
import PropTypes from 'prop-types'

import Modal from '@components/Modal'

const GameRegisterModal = ({
  isRegisterModalOpen,
  handleCloseRegisterModal,
  isRegisterSubmitting,
  handleSubmitRegister,
  registerTeamId,
  registerGameId,
  setRegisterTeamId,
  setRegisterGameId,
  registerFeedback,
  isRegisterTeamsLoading,
  registerTeams,
  location,
  currentUserTelegramIdNumber,
}) => (
  <Modal
            isOpen={isRegisterModalOpen}
            title="Регистрация команды по ID игры"
            onClose={handleCloseRegisterModal}
            footer={(
              <>
                <button
                  type="button"
                  onClick={handleCloseRegisterModal}
                  disabled={isRegisterSubmitting}
                  className={`inline-flex justify-center rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                    isRegisterSubmitting
                      ? 'cursor-not-allowed border-slate-200 text-slate-400 dark:border-slate-700 dark:text-slate-500'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={handleSubmitRegister}
                  disabled={
                    isRegisterSubmitting ||
                    !registerTeamId ||
                    registerGameId.trim().length === 0 ||
                    !location ||
                    !Number.isFinite(currentUserTelegramIdNumber)
                  }
                  className={`inline-flex justify-center rounded-xl px-4 py-2 text-sm font-semibold text-white transition ${
                    isRegisterSubmitting ||
                    !registerTeamId ||
                    registerGameId.trim().length === 0 ||
                    !location ||
                    !Number.isFinite(currentUserTelegramIdNumber)
                      ? 'bg-slate-400 cursor-not-allowed'
                      : 'bg-primary hover:bg-blue-700'
                  }`}
                >
                  {isRegisterSubmitting ? 'Регистрация…' : 'Зарегистрироваться'}
                </button>
              </>
            )}
          >
            <fieldset disabled={isRegisterSubmitting} className="m-0 space-y-5 border-0 p-0">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Укажите игру и команду, чтобы зарегистрировать её на участие. Команда должна принадлежать вам как капитану.
              </p>
              {registerFeedback && (
                <div
                  className={`rounded-2xl border p-4 text-sm ${
                    registerFeedback.type === 'success'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-rose-200 bg-rose-50 text-rose-700'
                  }`}
                >
                  {registerFeedback.message}
                </div>
              )}
              {(!location || !Number.isFinite(currentUserTelegramIdNumber)) && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
                  Укажите площадку и привяжите Telegram в профиле, чтобы регистрироваться на игры.
                </div>
              )}
              <div className="space-y-2">
                <label htmlFor="register-team-select" className="text-sm font-semibold text-primary">
                  Ваша команда
                </label>
                {isRegisterTeamsLoading ? (
                  <p className="text-sm text-slate-500">Загружаем список команд…</p>
                ) : registerTeams.length > 0 ? (
                  <select
                    id="register-team-select"
                    value={registerTeamId}
                    onChange={(event) => setRegisterTeamId(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200"
                  >
                    <option value="">Выберите команду</option>
                    {registerTeams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name || 'Без названия'}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-sm text-slate-500">
                    У вас пока нет команд, где вы являетесь капитаном. Создайте команду или запросите права капитана.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <label htmlFor="register-game-id" className="text-sm font-semibold text-primary">
                  ID игры
                </label>
                <input
                  id="register-game-id"
                  type="text"
                  value={registerGameId}
                  onChange={(event) => setRegisterGameId(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm uppercase tracking-wide focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200"
                  placeholder="Например, 64ff0c2e12"
                />
              </div>
            </fieldset>
          </Modal>
)

const registerTeamShape = PropTypes.shape({
  id: PropTypes.string.isRequired,
  name: PropTypes.string,
})

GameRegisterModal.propTypes = {
  isRegisterModalOpen: PropTypes.bool.isRequired,
  handleCloseRegisterModal: PropTypes.func.isRequired,
  isRegisterSubmitting: PropTypes.bool.isRequired,
  handleSubmitRegister: PropTypes.func.isRequired,
  registerTeamId: PropTypes.string.isRequired,
  registerGameId: PropTypes.string.isRequired,
  setRegisterTeamId: PropTypes.func.isRequired,
  setRegisterGameId: PropTypes.func.isRequired,
  registerFeedback: PropTypes.shape({
    type: PropTypes.string.isRequired,
    message: PropTypes.string.isRequired,
  }),
  isRegisterTeamsLoading: PropTypes.bool.isRequired,
  registerTeams: PropTypes.arrayOf(registerTeamShape).isRequired,
  location: PropTypes.shape({ city: PropTypes.string }),
  currentUserTelegramIdNumber: PropTypes.number,
}

GameRegisterModal.defaultProps = {
  registerFeedback: null,
  location: null,
  currentUserTelegramIdNumber: null,
}

export default memo(GameRegisterModal)
