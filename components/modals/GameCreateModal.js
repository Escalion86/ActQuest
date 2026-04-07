import { memo } from 'react'
import PropTypes from 'prop-types'

import Modal from '@components/Modal'
import CabinetInputField from '@components/cabinet/CabinetInputField'
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
  createGameMode,
  setCreateGameMode,
  cloneSourceGameId,
  setCloneSourceGameId,
  cloneSourceGames,
  isCloneSourceGamesLoading,
  createGameLocation,
  setCreateGameLocation,
  createGameSeasonId,
  setCreateGameSeasonId,
  createGameSeasons,
  isCreateGameSeasonsLoading,
  isCreateGameSeasonCreating,
  handleCreateSeasonForCreateGame,
  createGameLocationOptions,
  cloneOptions,
  onCloneOptionChange,
  isCreateGameActionDisabled,
  createGameFeedback,
}) => (
  <Modal
    isOpen={isCreateGameModalOpen}
    title="Создать игру"
    onClose={handleCloseCreateGameModal}
    footer={
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
          disabled={isCreatingGame || isCreateGameActionDisabled}
          className="aq-modal-btn aq-modal-btn-primary"
        >
          {isCreatingGame ? 'Создание…' : 'Создать'}
        </button>
      </>
    }
  >
    <fieldset disabled={isCreatingGame} className="m-0 space-y-5 border-0 p-0">
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Можно создать пустую игру или взять за основу существующую и скопировать
        нужные блоки.
      </p>
      <div className="space-y-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          Способ создания
        </p>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
          <input
            type="radio"
            name="game-create-mode"
            checked={createGameMode === 'empty'}
            onChange={() => setCreateGameMode('empty')}
          />
          Создать пустую игру
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
          <input
            type="radio"
            name="game-create-mode"
            checked={createGameMode === 'clone'}
            onChange={() => setCreateGameMode('clone')}
          />
          Взять за основу существующую игру
        </label>
      </div>
      {createGameFeedback && (
        <NoticeBanner
          tone={createGameFeedback.type === 'success' ? 'success' : 'error'}
          variant="neon"
        >
          {createGameFeedback.message}
        </NoticeBanner>
      )}
      <div className="space-y-2">
        <label
          htmlFor="new-game-location"
          className="block text-sm font-semibold text-slate-700 dark:text-slate-100"
        >
          Город игры
        </label>
        <select
          id="new-game-location"
          value={createGameLocation}
          onChange={(event) => setCreateGameLocation(event.target.value)}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200"
        >
          <option value="">Выберите город</option>
          {createGameLocationOptions.map((item) => (
            <option key={item.key} value={item.key}>
              {item.label}
            </option>
          ))}
        </select>
      </div>
      {createGameMode === 'empty' && (
        <CabinetInputField
          id="new-game-name"
          label="Название игры"
          value={newGameName}
          onChange={(event) => setNewGameName(event.target.value)}
          placeholder="Например, Ночной квест"
          inputClassName="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200"
        />
      )}
      {createGameMode === 'clone' && (
        <div className="space-y-4 rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
          <div className="space-y-2">
            <label
              htmlFor="clone-source-game"
              className="block text-sm font-semibold text-slate-700 dark:text-slate-100"
            >
              Игра-источник
            </label>
            <select
              id="clone-source-game"
              value={cloneSourceGameId}
              onChange={(event) => setCloneSourceGameId(event.target.value)}
              disabled={isCloneSourceGamesLoading}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200"
            >
              <option value="">
                {isCloneSourceGamesLoading
                  ? 'Загружаем игры…'
                  : 'Выберите игру'}
              </option>
              {cloneSourceGames.map((game) => (
                <option key={game.id} value={game.id}>
                  {game.label}
                </option>
              ))}
            </select>
          </div>
          <CabinetInputField
            id="new-game-name-clone"
            label="Название новой игры"
            value={newGameName}
            onChange={(event) => setNewGameName(event.target.value)}
            placeholder="Например, Ночной квест"
            inputClassName="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200"
          />
          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-100">
              Что клонировать
            </p>
            <div className="space-y-2">
              <NeonCheckbox
                id="clone-option-basic"
                checked={Boolean(cloneOptions.basic)}
                onChange={(event) =>
                  onCloneOptionChange('basic', event.target.checked)
                }
                label="Картинка и описание"
                className="w-full"
                labelClassName="text-sm text-slate-600 dark:text-slate-200"
              />
              <NeonCheckbox
                id="clone-option-rules"
                checked={Boolean(cloneOptions.rules)}
                onChange={(event) =>
                  onCloneOptionChange('rules', event.target.checked)
                }
                label="Правила игры (тип, перерыв, время на задания и подсказки)"
                className="w-full"
                labelClassName="text-sm text-slate-600 dark:text-slate-200"
              />
              <NeonCheckbox
                id="clone-option-captains"
                checked={Boolean(cloneOptions.captainRules)}
                onChange={(event) =>
                  onCloneOptionChange('captainRules', event.target.checked)
                }
                label="Правила для капитанов"
                className="w-full"
                labelClassName="text-sm text-slate-600 dark:text-slate-200"
              />
              <NeonCheckbox
                id="clone-option-tasks"
                checked={Boolean(cloneOptions.tasks)}
                onChange={(event) =>
                  onCloneOptionChange('tasks', event.target.checked)
                }
                label="Задания"
                className="w-full"
                labelClassName="text-sm text-slate-600 dark:text-slate-200"
              />
              <NeonCheckbox
                id="clone-option-locations"
                checked={Boolean(cloneOptions.locations)}
                onChange={(event) =>
                  onCloneOptionChange('locations', event.target.checked)
                }
                label="Локации сбора до и после игры"
                className="w-full"
                labelClassName="text-sm text-slate-600 dark:text-slate-200"
              />
              <NeonCheckbox
                id="clone-option-moderators"
                checked={Boolean(cloneOptions.moderators)}
                onChange={(event) =>
                  onCloneOptionChange('moderators', event.target.checked)
                }
                label="Модераторов"
                className="w-full"
                labelClassName="text-sm text-slate-600 dark:text-slate-200"
              />
              <NeonCheckbox
                id="clone-option-publish"
                checked={Boolean(cloneOptions.publication)}
                onChange={(event) =>
                  onCloneOptionChange('publication', event.target.checked)
                }
                label="Настройки публикации и результатов"
                className="w-full"
                labelClassName="text-sm text-slate-600 dark:text-slate-200"
              />
              <NeonCheckbox
                id="clone-option-prices"
                checked={Boolean(cloneOptions.prices)}
                onChange={(event) =>
                  onCloneOptionChange('prices', event.target.checked)
                }
                label="Стоимость участия"
                className="w-full"
                labelClassName="text-sm text-slate-600 dark:text-slate-200"
              />
            </div>
          </div>
        </div>
      )}
      <NoticeBanner tone="info" variant="neon">
        Рейтинговость и сезон можно настроить после создания в редакторе игры.
      </NoticeBanner>
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
  createGameMode: PropTypes.oneOf(['empty', 'clone']).isRequired,
  setCreateGameMode: PropTypes.func.isRequired,
  cloneSourceGameId: PropTypes.string.isRequired,
  setCloneSourceGameId: PropTypes.func.isRequired,
  cloneSourceGames: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
    }),
  ),
  isCloneSourceGamesLoading: PropTypes.bool,
  createGameLocation: PropTypes.string.isRequired,
  setCreateGameLocation: PropTypes.func.isRequired,
  createGameSeasonId: PropTypes.string.isRequired,
  setCreateGameSeasonId: PropTypes.func.isRequired,
  createGameSeasons: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      location: PropTypes.string,
    }),
  ),
  isCreateGameSeasonsLoading: PropTypes.bool,
  isCreateGameSeasonCreating: PropTypes.bool,
  handleCreateSeasonForCreateGame: PropTypes.func.isRequired,
  createGameLocationOptions: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
    }),
  ),
  cloneOptions: PropTypes.shape({
    basic: PropTypes.bool,
    rules: PropTypes.bool,
    captainRules: PropTypes.bool,
    tasks: PropTypes.bool,
    locations: PropTypes.bool,
    moderators: PropTypes.bool,
    publication: PropTypes.bool,
    prices: PropTypes.bool,
  }).isRequired,
  onCloneOptionChange: PropTypes.func.isRequired,
  isCreateGameActionDisabled: PropTypes.bool.isRequired,
  createGameFeedback: PropTypes.shape({
    type: PropTypes.string.isRequired,
    message: PropTypes.string.isRequired,
  }),
}

GameCreateModal.defaultProps = {
  createGameFeedback: null,
  cloneSourceGames: [],
  createGameSeasons: [],
  isCloneSourceGamesLoading: false,
  isCreateGameSeasonsLoading: false,
  isCreateGameSeasonCreating: false,
  createGameLocationOptions: [],
}

export default memo(GameCreateModal)
