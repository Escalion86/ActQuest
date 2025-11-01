import { memo } from 'react'
import PropTypes from 'prop-types'

import Modal from '@components/Modal'

const GameCreateModal = ({
  isCreateGameModalOpen,
  handleCloseCreateGameModal,
  isCreatingGame,
  handleCreateGame,
  newGameName,
  setNewGameName,
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
                  className={`inline-flex justify-center rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                    isCreatingGame
                      ? 'cursor-not-allowed border-slate-200 text-slate-400 dark:border-slate-700 dark:text-slate-500'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={handleCreateGame}
                  disabled={isCreatingGame || newGameName.trim().length === 0}
                  className={`inline-flex justify-center rounded-xl px-4 py-2 text-sm font-semibold text-white transition ${
                    isCreatingGame || newGameName.trim().length === 0
                      ? 'bg-slate-400 cursor-not-allowed'
                      : 'bg-primary hover:bg-blue-700'
                  }`}
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
                <div
                  className={`rounded-2xl border p-4 text-sm ${
                    createGameFeedback.type === 'success'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-rose-200 bg-rose-50 text-rose-700'
                  }`}
                >
                  {createGameFeedback.message}
                </div>
              )}
              <div className="space-y-2">
                <label htmlFor="new-game-name" className="text-sm font-semibold text-primary">
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
  createGameFeedback: PropTypes.shape({
    type: PropTypes.string.isRequired,
    message: PropTypes.string.isRequired,
  }),
}

GameCreateModal.defaultProps = {
  createGameFeedback: null,
}

export default memo(GameCreateModal)
