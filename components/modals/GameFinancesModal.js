import { memo } from 'react'
import PropTypes from 'prop-types'

import Modal from '@components/Modal'
import AmountStepperInput, {
  DEFAULT_MONEY_INPUT_CLASS_NAME,
} from '@components/cabinet/AmountStepperInput'
import CabinetButton from '@components/cabinet/CabinetButton'
import CabinetInputField from '@components/cabinet/CabinetInputField'
import CabinetSelectField from '@components/cabinet/CabinetSelectField'
import formatDate from '@helpers/formatDate'
import ModalSection from './ModalSection'

const amountInputClassName = DEFAULT_MONEY_INPUT_CLASS_NAME

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
  handleFinanceChange,
  handleRemoveFinance,
  currencyFormatter,
  financesSummary,
  balanceClass,
}) => {
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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
              Финансы игры
            </h2>
            <CabinetButton
              onClick={handleAddFinance}
              variant="primary"
              size="sm"
            >
              Добавить запись
            </CabinetButton>
          </div>

          {(selectedGame.finances ?? []).length > 0 ? (
            <div className="space-y-3">
              {selectedGame.finances.map((entry) => (
                <div
                  key={entry.id}
                  className="grid items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-[1fr_1fr_1fr_auto] dark:border-slate-700 dark:bg-slate-900/50"
                >
                  <CabinetSelectField
                    id={`game-finance-type-${entry.id}`}
                    label={null}
                    value={entry.type}
                    onChange={(event) =>
                      handleFinanceChange(entry.id, 'type', event.target.value)
                    }
                    containerClassName="w-full space-y-0"
                    selectClassName="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-900/70 dark:text-white"
                  >
                    <option value="income">Доход</option>
                    <option value="expense">Расход</option>
                  </CabinetSelectField>
                  <AmountStepperInput
                    value={entry.sum}
                    min={0}
                    step={100}
                    placeholder="Сумма"
                    className="max-w-none"
                    inputClassName={amountInputClassName}
                    onChange={(nextValue) =>
                      handleFinanceChange(entry.id, 'sum', nextValue)
                    }
                  />
                  <CabinetInputField
                    id={`game-finance-date-${entry.id}`}
                    label={null}
                    type="date"
                    value={entry.date ? formatDate(entry.date, true) : ''}
                    onChange={(event) =>
                      handleFinanceChange(entry.id, 'date', event.target.value)
                    }
                    containerClassName="w-full space-y-0"
                    inputClassName="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-900/70 dark:text-white"
                  />
                  <CabinetButton
                    onClick={() => handleRemoveFinance(entry.id)}
                    variant="secondary"
                    tone="danger"
                    size="sm"
                  >
                    Удалить
                  </CabinetButton>
                  <div className="md:col-span-3">
                    <CabinetInputField
                      id={`game-finance-description-${entry.id}`}
                      label={null}
                      type="text"
                      value={entry.description}
                      onChange={(event) =>
                        handleFinanceChange(
                          entry.id,
                          'description',
                          event.target.value,
                        )
                      }
                      placeholder="Комментарий"
                      containerClassName="w-full space-y-0"
                      inputClassName="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-900/70 dark:text-white"
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-200">
              Пока нет финансовых записей по этой игре. Добавьте доходы и
              расходы, чтобы контролировать бюджет.
            </p>
          )}

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
            <p className="text-sm text-slate-600 dark:text-slate-200">
              Доходы:{' '}
              <span className="font-semibold">
                {currencyFormatter.format(financesSummary.income)}
              </span>
            </p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-200">
              Расходы:{' '}
              <span className="font-semibold">
                {currencyFormatter.format(financesSummary.expense)}
              </span>
            </p>
            <p className={`mt-1 text-sm font-semibold ${balanceClass}`}>
              Баланс: {currencyFormatter.format(financesSummary.balance)}
            </p>
          </div>
        </ModalSection>
      </fieldset>
    </Modal>
  )
}

GameFinancesModal.propTypes = {
  selectedGame: PropTypes.shape({
    id: PropTypes.string,
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
  handleFinanceChange: PropTypes.func.isRequired,
  handleRemoveFinance: PropTypes.func.isRequired,
  currencyFormatter: PropTypes.instanceOf(Intl.NumberFormat).isRequired,
  financesSummary: PropTypes.shape({
    income: PropTypes.number.isRequired,
    expense: PropTypes.number.isRequired,
    balance: PropTypes.number.isRequired,
  }).isRequired,
  balanceClass: PropTypes.string.isRequired,
}

GameFinancesModal.defaultProps = {
  selectedGame: null,
  location: null,
}

export default memo(GameFinancesModal)
