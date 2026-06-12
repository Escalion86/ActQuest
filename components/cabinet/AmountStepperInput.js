import PropTypes from 'prop-types'

import {
  normalizeAmountStepperDisplayValue,
  normalizeAmountStepperValue,
} from '@helpers/amountStepperInput'

export const DEFAULT_MONEY_INPUT_CLASS_NAME =
  'aq-amount-step-input h-10 w-full rounded-xl border border-slate-200 bg-white pl-3 pr-8 py-2 text-center text-sm text-slate-800 focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-900/70 dark:text-white'

const AmountStepperInput = ({
  id,
  value,
  onChange,
  min,
  step,
  placeholder,
  className,
  inputClassName,
}) => {
  const currentValue = normalizeAmountStepperValue(value, min)

  const applyDelta = (delta) => {
    const next = Math.max(min, currentValue + delta)
    onChange(next)
  }

  return (
    <div className={`w-full max-w-[140px] ${className}`}>
      <div className="relative">
        <button
          type="button"
          onClick={() => applyDelta(-step)}
          className="absolute left-2 top-1/2 z-10 inline-flex h-6 w-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md bg-white text-[10px] leading-none text-slate-700 transition hover:bg-slate-100 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-900"
          aria-label="Уменьшить сумму"
          title="Уменьшить"
        >
          ▼
        </button>
        <input
          id={id}
          type="number"
          min={min}
          step={step}
          value={currentValue}
          onChange={(event) => {
            const rawValue = event.target.value
            if (rawValue === '') {
              onChange(min)
              return
            }
            const nextValue = Math.max(
              min,
              normalizeAmountStepperValue(rawValue, min),
            )
            event.target.value = normalizeAmountStepperDisplayValue(
              nextValue,
              min,
            )
            onChange(nextValue)
          }}
          placeholder={placeholder}
          className={inputClassName}
          style={{
            textAlign: 'center',
          }}
        />
        <button
          type="button"
          onClick={() => applyDelta(step)}
          className="absolute right-8 top-1/2 z-10 inline-flex h-6 w-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md bg-white text-[10px] leading-none text-slate-700 transition hover:bg-slate-100 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-900"
          aria-label="Увеличить сумму"
          title="Увеличить"
        >
          ▲
        </button>
        <span
          className="absolute text-sm font-semibold leading-none -translate-y-1/2 pointer-events-none right-3 top-1/2 text-slate-500 dark:text-slate-300"
          aria-hidden="true"
        >
          ₽
        </span>
      </div>
    </div>
  )
}

AmountStepperInput.propTypes = {
  id: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  onChange: PropTypes.func.isRequired,
  min: PropTypes.number,
  step: PropTypes.number,
  placeholder: PropTypes.string,
  className: PropTypes.string,
  inputClassName: PropTypes.string,
}

AmountStepperInput.defaultProps = {
  id: undefined,
  min: 0,
  step: 100,
  placeholder: 'Сумма',
  className: '',
  inputClassName: DEFAULT_MONEY_INPUT_CLASS_NAME,
}

export default AmountStepperInput
