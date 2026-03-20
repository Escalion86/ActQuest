import { memo } from 'react'
import PropTypes from 'prop-types'

import Modal from '@components/Modal'
import NoticeBanner from '@components/NoticeBanner'
import NeonCheckbox from '@components/NeonCheckbox'

const GameCreateModal = ({
  isCreateGameModalOpen,
  handleCloseCreateGameModal,
  isCreatingGame,
  handleCreateGame,
  newGameName,
  setNewGameName,
  newGameIsRated,
  setNewGameIsRated,
  createGameFeedback,
}) => (
  <Modal
            isOpen={isCreateGameModalOpen}
            title="Создать игру"
            onClose={handleCloseCreateGameModal}
            footer={(
              <>
                <button
                  type="button"
                  onClick={handleCloseCreateGameModal}
                  disabled={isCreatingGame}
                  className="aq-modal-btn aq-modal-btn-secondary"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={handleCreateGame}
                  disabled={isCreatingGame || newGameName.trim().length === 0}
                  className="aq-modal-btn aq-modal-btn-primary"
                >
                  {isCreatingGame ? 'Создание…' : 'Создать'}
                </button>
              </>
            )}
          >
            <fieldset disabled={isCreatingGame} className="m-0 space-y-5 border-0 p-0">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Будет создана пустая игра со стандартными настройками. После создания вы сможете настроить сценарий и задания.
              </p>
              {createGameFeedback && (
                <NoticeBanner
                  tone={createGameFeedback.type === 'success' ? 'success' : 'error'}
                  variant="neon"
                >
                  {createGameFeedback.message}
                </NoticeBanner>
              )}
              <div className="space-y-2">
                <label htmlFor="new-game-name" className="text-sm font-semibold text-slate-700 dark:text-slate-100">
                  Название игры
                </label>
                <input
                  id="new-game-name"
                  type="text"
                  value={newGameName}
                  onChange={(event) => setNewGameName(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200"
                  placeholder="Например, Ночной квест"
                />
              </div>
              <NeonCheckbox
                id="new-game-is-rated"
                checked={Boolean(newGameIsRated)}
                onChange={(event) => setNewGameIsRated(event.target.checked)}
                label="Рейтинговая игра"
                labelClassName="text-sm text-slate-600 dark:text-slate-200"
              />
            </fieldset>
          </Modal>
)

GameCreateModal.propTypes = {
  isCreateGameModalOpen: PropTypes.bool.isRequired,
  handleCloseCreateGameModal: PropTypes.func.isRequired,
  isCreatingGame: PropTypes.bool.isRequired,
  handleCreateGame: PropTypes.func.isRequired,
  newGameName: PropTypes.string.isRequired,
  setNewGameName: PropTypes.func.isRequired,
  newGameIsRated: PropTypes.bool.isRequired,
  setNewGameIsRated: PropTypes.func.isRequired,
  createGameFeedback: PropTypes.shape({
    type: PropTypes.string.isRequired,
    message: PropTypes.string.isRequired,
  }),
}

GameCreateModal.defaultProps = {
  createGameFeedback: null,
}

export default memo(GameCreateModal)
