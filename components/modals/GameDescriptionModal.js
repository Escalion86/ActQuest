import { memo } from 'react'
import PropTypes from 'prop-types'

import Modal from '@components/Modal'
import formatDate from '@helpers/formatDate'
import ModalSection from './ModalSection'
import ModalSectionTitle from './ModalSectionTitle'

const GameDescriptionModal = ({
  selectedGame,
  isDescriptionModalOpen,
  handleCloseDescriptionModal,
  gameTypeLabel,
  plannedStartLabel,
  canViewRestrictedGameInfo,
  canViewGameResults,
  handleOpenResultsModal,
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
                <ModalSection className="p-5">
                  <ModalSectionTitle>Общая информация</ModalSectionTitle>
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
                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Показывать результаты</dt>
                        <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                          {!selectedGame.hideResult ? 'Да' : 'Нет'}
                        </dd>
                      </div>
                    )}
                  </dl>
                </ModalSection>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-800/60">
                  <ModalSectionTitle>Описание</ModalSectionTitle>
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

                {canViewGameResults && (
                  <section className="rounded-2xl border border-cyan-200 bg-cyan-50 p-5 shadow-sm dark:border-cyan-500/35 dark:bg-cyan-500/10">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <ModalSectionTitle>Результаты игры</ModalSectionTitle>
                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                          Игра завершена, можно открыть итоговую таблицу команд.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleOpenResultsModal}
                        className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                      >
                        Посмотреть результаты
                      </button>
                    </div>
                  </section>
                )}

                <ModalSection className="p-5">
                  <ModalSectionTitle>Параметры проведения</ModalSectionTitle>
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
                </ModalSection>

                <ModalSection className="p-5">
                  <ModalSectionTitle>Опции для капитана</ModalSectionTitle>
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
                </ModalSection>

                <ModalSection className="p-5">
                  <ModalSectionTitle>Стоимость участия</ModalSectionTitle>
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
                </ModalSection>

                {canViewRestrictedGameInfo && (
                  <ModalSection className="p-5">
                    <ModalSectionTitle>Финансы</ModalSectionTitle>
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
                  </ModalSection>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-500">Выберите игру из списка слева, чтобы просмотреть детали.</p>
            )}
          </Modal>
)

GameDescriptionModal.propTypes = {
  selectedGame: PropTypes.shape({ name: PropTypes.string }),
  isDescriptionModalOpen: PropTypes.bool.isRequired,
  handleCloseDescriptionModal: PropTypes.func.isRequired,
  gameTypeLabel: PropTypes.string.isRequired,
  plannedStartLabel: PropTypes.string.isRequired,
  canViewRestrictedGameInfo: PropTypes.bool.isRequired,
  canViewGameResults: PropTypes.bool.isRequired,
  handleOpenResultsModal: PropTypes.func.isRequired,
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
