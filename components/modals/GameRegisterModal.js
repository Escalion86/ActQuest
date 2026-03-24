import { memo } from 'react'
import PropTypes from 'prop-types'

import Modal from '@components/Modal'
import CabinetFormField from '@components/cabinet/CabinetFormField'
import CabinetInputField from '@components/cabinet/CabinetInputField'
import CabinetSelectField from '@components/cabinet/CabinetSelectField'
import NoticeBanner from '@components/NoticeBanner'

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
  currentUserId,
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
                  className="aq-modal-btn aq-modal-btn-secondary"
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
                    !currentUserId
                  }
                  className="aq-modal-btn aq-modal-btn-primary"
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
                <NoticeBanner
                  tone={registerFeedback.type === 'success' ? 'success' : 'error'}
                  variant="neon"
                >
                  {registerFeedback.message}
                </NoticeBanner>
              )}
              {(!location || !currentUserId) && (
                <NoticeBanner tone="warning" variant="neon">
                  Не удалось определить пользователя или площадку для регистрации.
                </NoticeBanner>
              )}
              <CabinetFormField id="register-team-select" label="Ваша команда">
                {isRegisterTeamsLoading ? (
                  <p className="text-sm text-slate-500">Загружаем список команд…</p>
                ) : registerTeams.length > 0 ? (
                  <CabinetSelectField
                    id="register-team-select"
                    label={null}
                    value={registerTeamId}
                    onChange={(event) => setRegisterTeamId(event.target.value)}
                    containerClassName="space-y-0"
                  >
                    <option value="">Выберите команду</option>
                    {registerTeams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name || 'Без названия'}
                      </option>
                    ))}
                  </CabinetSelectField>
                ) : (
                  <p className="text-sm text-slate-500">
                    У вас пока нет команд, где вы являетесь капитаном. Создайте команду или запросите права капитана.
                  </p>
                )}
              </CabinetFormField>
              <CabinetInputField
                id="register-game-id"
                label="ID игры"
                value={registerGameId}
                onChange={(event) => setRegisterGameId(event.target.value)}
                placeholder="Например, 64ff0c2e12"
                inputClassName="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm uppercase tracking-wide focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200"
              />
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
  currentUserId: PropTypes.string,
}

GameRegisterModal.defaultProps = {
  registerFeedback: null,
  location: null,
  currentUserId: null,
}

export default memo(GameRegisterModal)
