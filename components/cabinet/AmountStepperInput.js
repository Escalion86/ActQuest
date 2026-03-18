import PropTypes from 'prop-types'

const normalizeNumber = (value, fallback = 0) => {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

const AmountStepperInput = ({
  value,
  onChange,
  min,
  step,
  placeholder,
  className,
  inputClassName,
}) => {
  const currentValue = normalizeNumber(value, min)

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
            onChange(Math.max(min, normalizeNumber(rawValue, min)))
          }}
          placeholder={placeholder}
          className={inputClassName}
          style={{ paddingLeft: '3rem', paddingRight: '3rem' }}
        />
        <button
          type="button"
          onClick={() => applyDelta(step)}
          className="absolute right-2 top-1/2 z-10 inline-flex h-6 w-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md bg-white text-[10px] leading-none text-slate-700 transition hover:bg-slate-100 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-900"
          aria-label="Увеличить сумму"
          title="Увеличить"
        >
          ▲
        </button>
      </div>
    </div>
  )
}

AmountStepperInput.propTypes = {
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  onChange: PropTypes.func.isRequired,
  min: PropTypes.number,
  step: PropTypes.number,
  placeholder: PropTypes.string,
  className: PropTypes.string,
  inputClassName: PropTypes.string,
}

AmountStepperInput.defaultProps = {
  min: 0,
  step: 100,
  placeholder: 'Сумма',
  className: '',
  inputClassName:
    'aq-amount-step-input h-10 w-full rounded-xl border border-slate-300 bg-white px-12 py-2 text-center text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100',
}

export default AmountStepperInput
