import { memo, useCallback, useEffect, useState } from 'react'
import PropTypes from 'prop-types'

import Modal from '@components/Modal'
import AmountStepperInput, {
  DEFAULT_MONEY_INPUT_CLASS_NAME,
} from '@components/cabinet/AmountStepperInput'
import CabinetButton from '@components/cabinet/CabinetButton'
import CabinetInputField from '@components/cabinet/CabinetInputField'
import CabinetSelectField from '@components/cabinet/CabinetSelectField'
import formatDate from '@helpers/formatDate'
import requestApiJson from '@helpers/requestApiJson'
import ModalSection from './ModalSection'
import TeamGamePaymentsModal from './TeamGamePaymentsModal'

const amountInputClassName = DEFAULT_MONEY_INPUT_CLASS_NAME

const createFinanceDraft = () => ({
  type: 'income',
  sum: '',
  date: formatDate(new Date(), true),
  description: '',
})

const getFinanceTypeMeta = (type) =>
  type === 'expense'
    ? {
        label: 'Расход',
        badgeClassName:
          'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200',
        amountClassName: 'text-rose-600 dark:text-rose-200',
        sign: '-',
      }
    : {
        label: 'Доход',
        badgeClassName:
          'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200',
        amountClassName: 'text-emerald-700 dark:text-emerald-200',
        sign: '+',
      }

const formatFinanceDate = (value) => formatDate(value) || 'Дата не указана'

const getMemberDisplayName = (member) => {
  const name = String(member?.name || member?.user?.name || '').trim()
  const username = String(
    member?.username || member?.user?.username || '',
  ).trim()
  const phone = String(member?.phone || member?.user?.phone || '').trim()
  return name || (username ? `@${username}` : '') || phone || 'Участник без имени'
}

const GameFinancesModal = ({
  selectedGame,
  isOpen,
  onClose,
  canEditSelectedGame,
  isSaving,
  isDirty,
  location,
  handlePrimaryAction,
  handleResetChanges,
  handleAddFinance,
  handleRemoveFinance,
  currencyFormatter,
  financesSummary,
}) => {
  const [teamPaymentsState, setTeamPaymentsState] = useState({
    isLoading: false,
    error: '',
    totalPaid: 0,
    totalDiscount: 0,
    totalCredited: 0,
    teams: [],
  })
  const [isTeamPaymentsModalOpen, setIsTeamPaymentsModalOpen] =
    useState(false)
  const [teamPaymentsTarget, setTeamPaymentsTarget] = useState(null)
  const [isFinanceCreateOpen, setIsFinanceCreateOpen] = useState(false)
  const [financeDraft, setFinanceDraft] = useState(() => createFinanceDraft())
  const [financeDraftError, setFinanceDraftError] = useState('')

  const loadTeamPaymentsSummary = useCallback(
    async ({ silent = false } = {}) => {
      if (!selectedGame?.id || !canEditSelectedGame) {
        setTeamPaymentsState({
          isLoading: false,
          error: '',
          totalPaid: 0,
          totalDiscount: 0,
          totalCredited: 0,
          teams: [],
        })
        return
      }

      setTeamPaymentsState((prev) => ({
        ...prev,
        isLoading: silent ? prev.isLoading : true,
        error: '',
      }))

      try {
        const { json } = await requestApiJson(
          `/api/cabinet/games/${encodeURIComponent(String(selectedGame.id))}/teams?scope=payments`,
          {
            fallbackMessage: 'Не удалось загрузить оплаты команд',
          },
        )

        const data = json?.data ?? {}
        setTeamPaymentsState({
          isLoading: false,
          error: '',
          totalPaid: Number(data.totalPaid) || 0,
          totalDiscount: Number(data.totalDiscount) || 0,
          totalCredited: Number(data.totalCredited) || 0,
          teams: Array.isArray(data.teams) ? data.teams : [],
        })
      } catch (error) {
        setTeamPaymentsState({
          isLoading: false,
          error: error?.message || 'Не удалось загрузить оплаты команд',
          totalPaid: 0,
          totalDiscount: 0,
          totalCredited: 0,
          teams: [],
        })
      }
    },
    [canEditSelectedGame, selectedGame?.id],
  )

  useEffect(() => {
    if (!isOpen) {
      setTeamPaymentsState({
        isLoading: false,
        error: '',
        totalPaid: 0,
        totalDiscount: 0,
        totalCredited: 0,
        teams: [],
      })
      setIsTeamPaymentsModalOpen(false)
      setTeamPaymentsTarget(null)
      setIsFinanceCreateOpen(false)
      setFinanceDraft(createFinanceDraft())
      setFinanceDraftError('')
      return
    }

    loadTeamPaymentsSummary()
  }, [isOpen, loadTeamPaymentsSummary])

  const handleOpenTeamPaymentsModal = useCallback((team) => {
    if (!team?.gameTeamId) {
      return
    }

    setTeamPaymentsTarget({
      gameTeamId: String(team.gameTeamId),
      teamId: String(team.teamId || ''),
      teamName: String(team.teamName || 'Без названия'),
      paidGame: Boolean(team.paidGame),
      totalPaid: Number(team.totalPaid) || 0,
      totalDiscount: Number(team.totalDiscount) || 0,
      totalCredited: Number(team.totalCredited) || 0,
      members: Array.isArray(team.members) ? team.members : [],
      memberPayments: Array.isArray(team.memberPayments)
        ? team.memberPayments
        : [],
    })
    setIsTeamPaymentsModalOpen(true)
  }, [])

  const handleCloseTeamPaymentsModal = useCallback(() => {
    setIsTeamPaymentsModalOpen(false)
    setTeamPaymentsTarget(null)
  }, [])

  const handlePaymentsChanged = useCallback(async () => {
    await loadTeamPaymentsSummary({ silent: true })
  }, [loadTeamPaymentsSummary])

  const handleOpenFinanceCreate = useCallback(() => {
    setFinanceDraft(createFinanceDraft())
    setFinanceDraftError('')
    setIsFinanceCreateOpen(true)
  }, [])

  const handleCloseFinanceCreate = useCallback(() => {
    if (isSaving) {
      return
    }
    setIsFinanceCreateOpen(false)
    setFinanceDraftError('')
  }, [isSaving])

  const handleFinanceDraftChange = useCallback((field, value) => {
    setFinanceDraft((prev) => ({
      ...prev,
      [field]:
        field === 'type' ? (value === 'expense' ? 'expense' : 'income') : value,
    }))
    setFinanceDraftError('')
  }, [])

  const handleCreateFinance = useCallback(() => {
    if (!canEditSelectedGame) {
      return
    }

    const sum = Number(financeDraft.sum)
    if (!Number.isFinite(sum) || sum <= 0) {
      setFinanceDraftError('Укажите сумму больше нуля')
      return
    }

    const date = financeDraft.date ? new Date(financeDraft.date) : null
    if (!date || !Number.isFinite(date.getTime())) {
      setFinanceDraftError('Укажите корректную дату')
      return
    }

    handleAddFinance({
      type: financeDraft.type === 'expense' ? 'expense' : 'income',
      sum,
      date: date.toISOString(),
      description:
        typeof financeDraft.description === 'string'
          ? financeDraft.description.trim()
          : '',
    })
    setIsFinanceCreateOpen(false)
    setFinanceDraft(createFinanceDraft())
    setFinanceDraftError('')
  }, [canEditSelectedGame, financeDraft, handleAddFinance])

  const modalFooter = (
    <>
      <CabinetButton
        onClick={handlePrimaryAction}
        disabled={isSaving || (isDirty && (!canEditSelectedGame || !location))}
        variant="primary"
      >
        {isDirty
          ? isSaving
            ? 'Сохранение…'
            : 'Сохранить и закрыть'
          : 'Закрыть'}
      </CabinetButton>
      {isDirty && (
        <CabinetButton
          onClick={handleResetChanges}
          disabled={!canEditSelectedGame}
          variant="secondary"
        >
          Отменить изменения
        </CabinetButton>
      )}
    </>
  )

  if (!selectedGame) {
    return (
      <Modal
        isOpen={isOpen}
        title="Финансы игры"
        onClose={onClose}
      >
        <p className="text-sm text-slate-500 dark:text-slate-300">
          Игра не выбрана. Закройте окно и откройте карточку снова.
        </p>
      </Modal>
    )
  }

  const teamPaymentsIncome = Number(teamPaymentsState.totalPaid) || 0
  const paymentDiscounts = Number(teamPaymentsState.totalDiscount) || 0
  const paymentMode =
    selectedGame.paymentMode === 'participant' ? 'participant' : 'team'
  const summaryIncome = financesSummary.income + teamPaymentsIncome
  const summaryBalance = summaryIncome - financesSummary.expense
  const summaryBalanceClass =
    summaryBalance >= 0 ? 'text-emerald-600' : 'text-rose-600'

  return (
    <Modal
      isOpen={isOpen}
      title={`Финансы игры — ${selectedGame.name || 'Без названия'}`}
      onClose={onClose}
      footer={modalFooter}
    >
      <fieldset
        disabled={!canEditSelectedGame || isSaving}
        className="m-0 space-y-6 border-0 p-0 [&_button]:cursor-pointer [&_select]:cursor-pointer"
      >
        <ModalSection>
          <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
            Сводка
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-500/40 dark:bg-emerald-500/10">
              <p className="text-xs font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-200">
                Доходы
              </p>
              <p className="mt-1 flex flex-wrap items-baseline gap-x-1 text-sm font-semibold text-emerald-700 dark:text-emerald-100">
                <span>{currencyFormatter.format(financesSummary.income)}</span>
                <span>+</span>
                <span>{currencyFormatter.format(teamPaymentsIncome)}</span>
                <span>=</span>
                <span className="text-base">
                  {currencyFormatter.format(summaryIncome)}
                </span>
              </p>
            </div>
            <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4 dark:border-violet-500/40 dark:bg-violet-500/10">
              <p className="text-xs font-medium uppercase tracking-wide text-violet-700 dark:text-violet-200">
                Скидки
              </p>
              <p className="mt-1 text-base font-semibold text-violet-700 dark:text-violet-100">
                {currencyFormatter.format(paymentDiscounts)}
              </p>
              <p className="mt-1 text-xs text-violet-600 dark:text-violet-200/80">
                Учтены в оплате, но не входят в доход
              </p>
            </div>
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-500/40 dark:bg-rose-500/10">
              <p className="text-xs font-medium uppercase tracking-wide text-rose-700 dark:text-rose-200">
                Расходы
              </p>
              <p className="mt-1 text-base font-semibold text-rose-700 dark:text-rose-100">
                {currencyFormatter.format(financesSummary.expense)}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-300">
                Баланс
              </p>
              <p className={`mt-1 text-base font-semibold ${summaryBalanceClass}`}>
                {currencyFormatter.format(summaryBalance)}
              </p>
            </div>
          </div>
        </ModalSection>

        <ModalSection>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
              Финансы игры
            </h2>
            <span
              className={`rounded-xl border px-3 py-1.5 text-sm font-semibold ${
                financesSummary.balance >= 0
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200'
                  : 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200'
              }`}
            >
              Итого: {currencyFormatter.format(financesSummary.balance)}
            </span>
          </div>

          {(selectedGame.finances ?? []).length > 0 ? (
            <div className="space-y-3">
              {selectedGame.finances.map((entry) => {
                const typeMeta = getFinanceTypeMeta(entry.type)
                const amount = Number(entry.sum) || 0

                return (
                  <div
                    key={entry.id}
                    className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/50 sm:flex-row sm:items-start sm:justify-between"
                  >
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${typeMeta.badgeClassName}`}
                        >
                          {typeMeta.label}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-300">
                          {formatFinanceDate(entry.date)}
                        </span>
                      </div>
                      <p
                        className={`text-base font-semibold ${typeMeta.amountClassName}`}
                      >
                        {typeMeta.sign}
                        {currencyFormatter.format(amount)}
                      </p>
                      <p className="text-sm text-slate-600 dark:text-slate-200">
                        {entry.description || 'Комментарий не указан'}
                      </p>
                    </div>
                    <CabinetButton
                      onClick={() => handleRemoveFinance(entry.id)}
                      variant="secondary"
                      tone="danger"
                      size="sm"
                    >
                      Удалить
                    </CabinetButton>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-200">
              Пока нет финансовых записей по этой игре. Добавьте доходы и
              расходы, чтобы контролировать бюджет.
            </p>
          )}

          <div className="flex justify-end">
            <CabinetButton
              onClick={handleOpenFinanceCreate}
              variant="primary"
              size="sm"
            >
              Добавить запись
            </CabinetButton>
          </div>
        </ModalSection>

        <ModalSection>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
              {paymentMode === 'participant'
                ? 'Оплаты участников'
                : 'Оплаты команд'}
            </h2>
            <div className="flex flex-wrap gap-2 text-sm font-semibold">
              <span className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200">
                Оплачено: {currencyFormatter.format(teamPaymentsState.totalPaid)}
              </span>
              {teamPaymentsState.totalDiscount > 0 ? (
                <span className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-1.5 text-violet-700 dark:border-violet-500/40 dark:bg-violet-500/10 dark:text-violet-200">
                  Скидки: {currencyFormatter.format(teamPaymentsState.totalDiscount)}
                </span>
              ) : null}
            </div>
          </div>

          {teamPaymentsState.error ? (
            <p className="text-sm text-rose-600 dark:text-rose-200">
              {teamPaymentsState.error}
            </p>
          ) : teamPaymentsState.isLoading ? (
            <p className="text-sm text-slate-500 dark:text-slate-200">
              Загружаем оплаты…
            </p>
          ) : teamPaymentsState.teams.length > 0 ? (
            <div className="space-y-2">
              {teamPaymentsState.teams.map((team) => {
                const teamHasPayment =
                  Boolean(team.paidGame) || Number(team.totalCredited) > 0
                const paymentsByUserId = new Map(
                  (Array.isArray(team.memberPayments)
                    ? team.memberPayments
                    : []
                  ).map((item) => [String(item.userId || ''), item]),
                )

                return (
                <button
                  type="button"
                  key={team.gameTeamId}
                  onClick={() => handleOpenTeamPaymentsModal(team)}
                  className="w-full cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-emerald-300 hover:bg-emerald-50/60 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200 dark:border-slate-700 dark:bg-slate-900/50 dark:hover:border-emerald-500/45 dark:hover:bg-emerald-500/10 dark:focus:ring-emerald-500/20"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2">
                      <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {team.teamName || 'Команда без названия'}
                      </p>
                      {paymentMode === 'team' ? (
                        <span
                          className={`inline-flex shrink-0 rounded-full border px-2 py-1 text-xs font-medium ${
                            teamHasPayment
                              ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200'
                              : 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200'
                          }`}
                        >
                          {teamHasPayment ? 'Оплачено' : 'Не оплачено'}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">
                      Транзакций: {Number(team.transactionsCount) || 0}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="block text-sm font-semibold text-emerald-700 dark:text-emerald-200">
                      {currencyFormatter.format(Number(team.totalPaid) || 0)}
                    </span>
                    {Number(team.totalDiscount) > 0 ? (
                      <span className="block text-xs text-violet-600 dark:text-violet-200">
                        + скидка {currencyFormatter.format(team.totalDiscount)}
                      </span>
                    ) : null}
                  </div>
                  </div>
                  {paymentMode === 'participant' ? (
                    <div className="mt-3 divide-y divide-slate-100 border-t border-slate-200 pt-2 dark:divide-slate-800 dark:border-slate-700">
                      {(Array.isArray(team.members) ? team.members : []).map(
                        (member) => {
                          const userId = String(member?.userId || '')
                          const payment = paymentsByUserId.get(userId) || {}
                          const isPaid = Number(payment.totalCredited) > 0
                          return (
                            <div
                              key={userId || member?.membershipId}
                              className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs"
                            >
                              <span className="font-medium text-slate-700 dark:text-slate-200">
                                {getMemberDisplayName(member)}
                              </span>
                              <span className="flex flex-wrap items-center justify-end gap-2">
                                <span className="text-slate-600 dark:text-slate-300">
                                  {currencyFormatter.format(
                                    Number(payment.totalPaid) || 0,
                                  )}
                                  {Number(payment.totalDiscount) > 0
                                    ? ` + скидка ${currencyFormatter.format(payment.totalDiscount)}`
                                    : ''}
                                </span>
                                <span
                                  className={`rounded-full border px-2 py-1 font-medium ${
                                    isPaid
                                      ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200'
                                      : 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200'
                                  }`}
                                >
                                  {isPaid ? 'Оплачено' : 'Не оплачено'}
                                </span>
                              </span>
                            </div>
                          )
                        },
                      )}
                    </div>
                  ) : null}
                </button>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-200">
              Пока нет зарегистрированных команд по этой игре.
            </p>
          )}
        </ModalSection>
      </fieldset>
      <TeamGamePaymentsModal
        isOpen={isTeamPaymentsModalOpen}
        onClose={handleCloseTeamPaymentsModal}
        selectedGame={selectedGame}
        target={teamPaymentsTarget}
        onPaymentsChanged={handlePaymentsChanged}
      />
      <Modal
        isOpen={isFinanceCreateOpen}
        title="Добавить финансовую запись"
        onClose={handleCloseFinanceCreate}
        dialogClassName="md:max-w-xl"
        footer={
          <>
            <CabinetButton
              onClick={handleCreateFinance}
              disabled={!canEditSelectedGame || isSaving}
              variant="primary"
            >
              Добавить
            </CabinetButton>
            <CabinetButton
              onClick={handleCloseFinanceCreate}
              disabled={isSaving}
              variant="secondary"
            >
              Отмена
            </CabinetButton>
          </>
        }
      >
        <fieldset
          disabled={!canEditSelectedGame || isSaving}
          className="m-0 space-y-4 border-0 p-0"
        >
          <CabinetSelectField
            id="game-finance-create-type"
            label="Тип записи"
            value={financeDraft.type}
            onChange={(event) =>
              handleFinanceDraftChange('type', event.target.value)
            }
            selectClassName="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-900/70 dark:text-white"
          >
            <option value="income">Доход</option>
            <option value="expense">Расход</option>
          </CabinetSelectField>
          <AmountStepperInput
            value={financeDraft.sum}
            min={0}
            step={100}
            placeholder="Сумма"
            className="max-w-none"
            inputClassName={amountInputClassName}
            onChange={(nextValue) =>
              handleFinanceDraftChange('sum', nextValue)
            }
          />
          <CabinetInputField
            id="game-finance-create-date"
            label="Дата"
            type="date"
            value={financeDraft.date}
            onChange={(event) =>
              handleFinanceDraftChange('date', event.target.value)
            }
            inputClassName="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-900/70 dark:text-white"
          />
          <CabinetInputField
            id="game-finance-create-description"
            label="Комментарий"
            type="text"
            value={financeDraft.description}
            onChange={(event) =>
              handleFinanceDraftChange('description', event.target.value)
            }
            placeholder="Например: аренда, призы, взнос партнёра"
            inputClassName="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-900/70 dark:text-white"
          />
          {financeDraftError ? (
            <p className="text-sm text-rose-600 dark:text-rose-200">
              {financeDraftError}
            </p>
          ) : null}
        </fieldset>
      </Modal>
    </Modal>
  )
}

GameFinancesModal.propTypes = {
  selectedGame: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    name: PropTypes.string,
    finances: PropTypes.arrayOf(
      PropTypes.shape({
        id: PropTypes.string.isRequired,
        type: PropTypes.oneOf(['income', 'expense']),
        sum: PropTypes.number,
        date: PropTypes.string,
        description: PropTypes.string,
      }),
    ),
    paymentMode: PropTypes.oneOf(['team', 'participant']),
  }),
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  canEditSelectedGame: PropTypes.bool.isRequired,
  isSaving: PropTypes.bool.isRequired,
  isDirty: PropTypes.bool.isRequired,
  location: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.shape({ city: PropTypes.string }),
  ]),
  handlePrimaryAction: PropTypes.func.isRequired,
  handleResetChanges: PropTypes.func.isRequired,
  handleAddFinance: PropTypes.func.isRequired,
  handleRemoveFinance: PropTypes.func.isRequired,
  currencyFormatter: PropTypes.instanceOf(Intl.NumberFormat).isRequired,
  financesSummary: PropTypes.shape({
    income: PropTypes.number.isRequired,
    expense: PropTypes.number.isRequired,
    balance: PropTypes.number.isRequired,
  }).isRequired,
}

GameFinancesModal.defaultProps = {
  selectedGame: null,
  location: null,
}

export default memo(GameFinancesModal)
