import { memo } from 'react'
import PropTypes from 'prop-types'

import Modal from '@components/Modal'
import CabinetButton from '@components/cabinet/CabinetButton'

const GameStatusModal = ({
  isOpen,
  onClose,
  gameName,
  currentStatusLabel,
  actions,
  onAction,
  validationResult,
  isSaving,
  progressMessage,
}) => (
  <Modal
    isOpen={isOpen}
    title={`Смена статуса — ${gameName || 'Без названия'}`}
    onClose={onClose}
    footer={
      <CabinetButton onClick={onClose} variant="secondary" disabled={isSaving}>
        Закрыть
      </CabinetButton>
    }
  >
    <div className="space-y-4">
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Текущий статус:{' '}
        <span className="font-semibold text-slate-800 dark:text-slate-100">
          {currentStatusLabel}
        </span>
      </p>
      {actions.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {actions.map((action) => (
            <div
              key={action.id}
              className="p-3 border rounded-xl border-slate-200/80 dark:border-slate-700/80"
            >
              <CabinetButton
                onClick={() => onAction(action.id)}
                variant={action.variant}
                tone={action.tone}
                size="md"
                disabled={isSaving || Boolean(action.disabled)}
                className={`w-full ${isSaving ? 'cursor-wait' : ''}`}
              >
                {action.label}
              </CabinetButton>
              {action.description ? (
                <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-300">
                  {action.description}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500 dark:text-slate-300">
          Для этого статуса нет доступных действий.
        </p>
      )}
      <p className="text-xs text-slate-500 dark:text-slate-300">
        «СТАРТ ИГРЫ» и «СТОП ИГРА» запускают серверные сценарии с оповещением
        игроков.
      </p>
      {isSaving && progressMessage ? (
        <div className="flex items-center gap-3 px-4 py-3 border rounded-xl border-sky-300/70 bg-sky-50/80 dark:border-sky-500/50 dark:bg-sky-500/10">
          <svg
            className="w-5 h-5 shrink-0 animate-spin text-sky-600 dark:text-sky-300"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <p className="text-sm font-medium text-sky-700 dark:text-sky-200">
            {progressMessage}
          </p>
        </div>
      ) : null}
      {validationResult ? (
        <div
          className={`rounded-xl border px-4 py-3 ${
            validationResult.hasErrors
              ? 'border-rose-300/70 bg-rose-50/80 dark:border-rose-500/50 dark:bg-rose-500/10'
              : 'border-emerald-300/70 bg-emerald-50/80 dark:border-emerald-500/50 dark:bg-emerald-500/10'
          }`}
        >
          <p
            className={`text-sm font-semibold ${
              validationResult.hasErrors
                ? 'text-rose-700 dark:text-rose-200'
                : 'text-emerald-700 dark:text-emerald-200'
            }`}
          >
            {validationResult.hasErrors
              ? `Обнаружены ошибки (${validationResult.errors.length})`
              : 'Ошибки не обнаружены'}
          </p>
          {validationResult.hasErrors ? (
            <ul className="mt-2 space-y-1">
              {validationResult.errors.map((error) => (
                <li
                  key={error}
                  className="text-xs text-rose-700 dark:text-rose-200"
                >
                  • {error}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  </Modal>
)

GameStatusModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  gameName: PropTypes.string,
  currentStatusLabel: PropTypes.string.isRequired,
  actions: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      id: PropTypes.string.isRequired,
      variant: PropTypes.oneOf(['primary', 'secondary', 'soft']).isRequired,
      tone: PropTypes.oneOf(['neutral', 'brand', 'cyan', 'success', 'danger'])
        .isRequired,
      description: PropTypes.string,
      disabled: PropTypes.bool,
    }),
  ).isRequired,
  onAction: PropTypes.func.isRequired,
  validationResult: PropTypes.shape({
    hasErrors: PropTypes.bool.isRequired,
    errors: PropTypes.arrayOf(PropTypes.string).isRequired,
  }),
  isSaving: PropTypes.bool.isRequired,
  progressMessage: PropTypes.string,
}

GameStatusModal.defaultProps = {
  gameName: '',
  validationResult: null,
  progressMessage: '',
}

export default memo(GameStatusModal)
