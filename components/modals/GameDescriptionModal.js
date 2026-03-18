import { memo } from 'react'
import PropTypes from 'prop-types'

import Modal from '@components/Modal'
import formatDate from '@helpers/formatDate'

const sectionHeadingClass = 'aq-modal-section-title text-base font-semibold'

const GameDescriptionModal = ({
  selectedGame,
  isDescriptionModalOpen,
  handleCloseDescriptionModal,
  gameTypeLabel,
  plannedStartLabel,
  canViewRestrictedGameInfo,
  canEditSelectedGame,
  selectedGameModerators,
  availableModeratorsForSelect,
  availableModeratorsMap,
  selectedModeratorToAdd,
  setSelectedModeratorToAdd,
  handleAddModerator,
  handleRemoveModerator,
  taskDurationLabel,
  cluesDurationLabel,
  clueModeDetails,
  breakDurationLabel,
  taskFailurePenaltyLabel,
  manyCodesLimitLabel,
  manyCodesPenaltyLabel,
  currencyFormatter,
  financesSummary,
  balanceClass,
}) => (
  <Modal
            isOpen={isDescriptionModalOpen}
            title={`Игра — ${selectedGame?.name || 'Без названия'}`}
            onClose={handleCloseDescriptionModal}
          >
            {selectedGame ? (
              <div className="space-y-6">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-800/60">
                  <h4 className={sectionHeadingClass}>Описание</h4>
                  {selectedGame.description ? (
                    <p className="mt-3 whitespace-pre-line text-sm text-slate-600 dark:text-slate-300">
                      {selectedGame.description}
                    </p>
                  ) : (
                    <p className="mt-3 text-sm text-slate-500">
                      Описание для этой игры не заполнено.
                    </p>
                  )}
                </div>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
                  <h4 className={sectionHeadingClass}>Общая информация</h4>
                  {selectedGame.image && (
                    <img
                      src={selectedGame.image}
                      alt="Обложка игры"
                      className="mt-4 h-48 w-full rounded-xl object-cover"
                    />
                  )}
                  <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Тип игры</dt>
                      <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">{gameTypeLabel}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Плановое начало</dt>
                      <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">{plannedStartLabel}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Место старта</dt>
                      <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                        {selectedGame.startingPlace || 'Не указано'}
                      </dd>
                    </div>
                    {canViewRestrictedGameInfo && (
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Финиш</dt>
                        <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                          {selectedGame.finishingPlace || 'Не указан'}
                        </dd>
                      </div>
                    )}
                    {canViewRestrictedGameInfo && (
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Индивидуальный старт</dt>
                        <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                          {selectedGame.individualStart ? 'Да' : 'Нет'}
                        </dd>
                      </div>
                    )}
                    {canViewRestrictedGameInfo && (
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Показывать организатора</dt>
                        <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                          {selectedGame.showCreator ? 'Да' : 'Нет'}
                        </dd>
                      </div>
                    )}
                    {canViewRestrictedGameInfo && (
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Публиковать задания в кабинете</dt>
                        <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                          {selectedGame.showTasks ? 'Да' : 'Нет'}
                        </dd>
                      </div>
                    )}
                    {canViewRestrictedGameInfo && (
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Скрывать результаты</dt>
                        <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                          {selectedGame.hideResult ? 'Да' : 'Нет'}
                        </dd>
                      </div>
                    )}
                  </dl>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
                  <h4 className={sectionHeadingClass}>Модераторы игры</h4>
                  {selectedGameModerators.length > 0 ? (
                    <ul className="mt-4 space-y-3">
                      {selectedGameModerators.map((moderator) => {
                        const moderatorId = typeof moderator === 'string' ? moderator : moderator.id
                        const fallback =
                          typeof moderator === 'string' ? availableModeratorsMap.get(moderator) : null
                        const name =
                          typeof moderator === 'string' ? fallback?.name ?? 'Без имени' : moderator.name || 'Без имени'
                        const username =
                          typeof moderator === 'string' ? fallback?.username ?? '' : moderator.username || ''
                        const telegramId =
                          typeof moderator === 'string' ? fallback?.telegramId ?? '' : moderator.telegramId || ''

                        return (
                          <li
                            key={moderatorId}
                            className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900/80"
                          >
                            <div>
                              <p className="aq-modal-item-title text-sm font-semibold">{name}</p>
                              {username && <p className="text-xs text-slate-500">@{username}</p>}
                              {telegramId && <p className="text-xs text-slate-400">ID: {telegramId}</p>}
                            </div>
                            {canEditSelectedGame && (
                              <button
                                type="button"
                                onClick={() => handleRemoveModerator(moderatorId)}
                                className="inline-flex items-center rounded-xl border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 dark:border-rose-400/40 dark:text-rose-200 dark:hover:bg-rose-500/10"
                              >
                                Удалить
                              </button>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  ) : (
                    <p className="mt-4 text-sm text-slate-500">Модераторы пока не назначены.</p>
                  )}

                  {canEditSelectedGame && (
                    <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 dark:border-slate-700">
                      <label htmlFor="modal-game-moderator" className="aq-modal-item-title text-sm font-semibold">
                        Добавить модератора
                      </label>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <select
                          id="modal-game-moderator"
                          value={selectedModeratorToAdd}
                          onChange={(event) => setSelectedModeratorToAdd(event.target.value)}
                          className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200"
                        >
                          <option value="">Выберите модератора</option>
                          {availableModeratorsForSelect.map((moderator) => {
                            const labelParts = [moderator.name || 'Без имени']
                            if (moderator.username) {
                              labelParts.push(`@${moderator.username}`)
                            }
                            if (moderator.telegramId) {
                              labelParts.push(`ID: ${moderator.telegramId}`)
                            }

                            return (
                              <option key={moderator.id} value={moderator.id}>
                                {labelParts.join(' · ')}
                              </option>
                            )
                          })}
                        </select>
                        <button
                          type="button"
                          onClick={handleAddModerator}
                          disabled={!selectedModeratorToAdd}
                          className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600 dark:disabled:bg-slate-700 dark:disabled:text-slate-400"
                        >
                          Добавить
                        </button>
                      </div>
                      {availableModeratorsForSelect.length === 0 && (
                        <p className="text-xs text-slate-500">Все доступные модераторы уже назначены на эту игру.</p>
                      )}
                    </div>
                  )}
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
                  <h4 className={sectionHeadingClass}>Параметры проведения</h4>
                  <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Длительность задания</dt>
                      <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">{taskDurationLabel}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Интервал подсказок</dt>
                      <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">{cluesDurationLabel}</dd>
                    </div>
                    {canViewRestrictedGameInfo && (
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Режим досрочной подсказки</dt>
                        <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                          {clueModeDetails.modeLabel}
                          <br />
                          <span className="text-xs text-slate-500">{clueModeDetails.valueLabel}</span>
                        </dd>
                      </div>
                    )}
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Перерыв между заданиями</dt>
                      <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">{breakDurationLabel}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Штраф за невыполненное задание</dt>
                      <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">{taskFailurePenaltyLabel}</dd>
                    </div>
                    {canViewRestrictedGameInfo && manyCodesLimitLabel && (
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Лимит неверных кодов</dt>
                        <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">{manyCodesLimitLabel}</dd>
                      </div>
                    )}
                    {canViewRestrictedGameInfo && manyCodesPenaltyLabel && (
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Штраф за превышение лимита</dt>
                        <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">{manyCodesPenaltyLabel}</dd>
                      </div>
                    )}
                  </dl>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
                  <h4 className={sectionHeadingClass}>Опции для капитана</h4>
                  <ul className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                    <li className="flex items-center gap-2">
                      <span
                        className={`h-2 w-2 rounded-full ${selectedGame.allowCaptainForceClue ? 'bg-emerald-500' : 'bg-slate-400'}`}
                        aria-hidden="true"
                      />
                      <span>
                        Капитан {selectedGame.allowCaptainForceClue ? 'может' : 'не может'} запрашивать подсказку
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span
                        className={`h-2 w-2 rounded-full ${selectedGame.allowCaptainFailTask ? 'bg-emerald-500' : 'bg-slate-400'}`}
                        aria-hidden="true"
                      />
                      <span>
                        Капитан {selectedGame.allowCaptainFailTask ? 'может' : 'не может'} провалить задание
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span
                        className={`h-2 w-2 rounded-full ${selectedGame.allowCaptainFinishBreak ? 'bg-emerald-500' : 'bg-slate-400'}`}
                        aria-hidden="true"
                      />
                      <span>
                        Капитан {selectedGame.allowCaptainFinishBreak ? 'может' : 'не может'} завершать перерыв
                      </span>
                    </li>
                  </ul>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
                  <h4 className={sectionHeadingClass}>Стоимость участия</h4>
                  {selectedGame.prices?.length > 0 ? (
                    <ul className="mt-4 space-y-3">
                      {selectedGame.prices.map((price) => (
                        <li
                          key={price.id}
                          className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-800/80"
                        >
                          <span className="text-slate-600 dark:text-slate-200">{price.name || 'Без названия'}</span>
                          <span className="aq-modal-item-title font-semibold">
                            {currencyFormatter.format(Number(price.price) || 0)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-4 text-sm text-slate-500">Стоимость участия не указана.</p>
                  )}
                </section>

                {canViewRestrictedGameInfo && (
                  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
                    <h4 className={sectionHeadingClass}>Финансы</h4>
                    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200">
                      <p>
                        Доходы: <span className="font-semibold">{currencyFormatter.format(financesSummary.income)}</span>
                      </p>
                      <p className="mt-1">
                        Расходы: <span className="font-semibold">{currencyFormatter.format(financesSummary.expense)}</span>
                      </p>
                      <p className={`mt-1 font-semibold ${balanceClass}`}>
                        Баланс: {currencyFormatter.format(financesSummary.balance)}
                      </p>
                    </div>
                    {selectedGame.finances?.length > 0 ? (
                      <ul className="mt-4 space-y-3">
                        {selectedGame.finances.map((entry) => (
                          <li
                            key={entry.id}
                            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-800/80"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <span
                                className={`text-xs font-semibold ${
                                  entry.type === 'expense' ? 'text-rose-600' : 'text-emerald-600'
                                }`}
                              >
                                {entry.type === 'expense' ? 'Расход' : 'Доход'}
                              </span>
                              <span className="aq-modal-item-title text-sm font-semibold">
                                {currencyFormatter.format(Number(entry.sum) || 0)}
                              </span>
                            </div>
                            <p className="mt-2 text-xs text-slate-500">
                              {entry.date ? formatDate(entry.date) : 'Дата не указана'}
                            </p>
                            {entry.description ? (
                              <p className="mt-2 whitespace-pre-line text-sm text-slate-600 dark:text-slate-300">
                                {entry.description}
                              </p>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-4 text-sm text-slate-500">Финансовые записи отсутствуют.</p>
                    )}
                  </section>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-500">Выберите игру из списка слева, чтобы просмотреть детали.</p>
            )}
          </Modal>
)

const moderatorShape = PropTypes.oneOfType([
  PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string,
    username: PropTypes.string,
    telegramId: PropTypes.string,
  }),
  PropTypes.string,
])

const moderatorOptionShape = PropTypes.shape({
  id: PropTypes.string.isRequired,
  name: PropTypes.string,
  username: PropTypes.string,
  telegramId: PropTypes.string,
})

GameDescriptionModal.propTypes = {
  selectedGame: PropTypes.shape({ name: PropTypes.string }),
  isDescriptionModalOpen: PropTypes.bool.isRequired,
  handleCloseDescriptionModal: PropTypes.func.isRequired,
  gameTypeLabel: PropTypes.string.isRequired,
  plannedStartLabel: PropTypes.string.isRequired,
  canViewRestrictedGameInfo: PropTypes.bool.isRequired,
  canEditSelectedGame: PropTypes.bool.isRequired,
  selectedGameModerators: PropTypes.arrayOf(moderatorShape).isRequired,
  availableModeratorsForSelect: PropTypes.arrayOf(moderatorOptionShape).isRequired,
  availableModeratorsMap: PropTypes.instanceOf(Map).isRequired,
  selectedModeratorToAdd: PropTypes.string.isRequired,
  setSelectedModeratorToAdd: PropTypes.func.isRequired,
  handleAddModerator: PropTypes.func.isRequired,
  handleRemoveModerator: PropTypes.func.isRequired,
  taskDurationLabel: PropTypes.string.isRequired,
  cluesDurationLabel: PropTypes.string.isRequired,
  clueModeDetails: PropTypes.shape({
    modeLabel: PropTypes.string.isRequired,
    valueLabel: PropTypes.string.isRequired,
  }).isRequired,
  breakDurationLabel: PropTypes.string.isRequired,
  taskFailurePenaltyLabel: PropTypes.string.isRequired,
  manyCodesLimitLabel: PropTypes.string,
  manyCodesPenaltyLabel: PropTypes.string,
  currencyFormatter: PropTypes.instanceOf(Intl.NumberFormat).isRequired,
  financesSummary: PropTypes.shape({
    income: PropTypes.number.isRequired,
    expense: PropTypes.number.isRequired,
    balance: PropTypes.number.isRequired,
  }).isRequired,
  balanceClass: PropTypes.string.isRequired,
}

GameDescriptionModal.defaultProps = {
  selectedGame: null,
  manyCodesLimitLabel: null,
  manyCodesPenaltyLabel: null,
}

export default memo(GameDescriptionModal)
