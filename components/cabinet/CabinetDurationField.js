import { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import CabinetFormField from '@components/cabinet/CabinetFormField'

const DEFAULT_INPUT_CLASS =
  'w-0 flex-1 border-0 bg-transparent px-3 py-2 text-left text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100 dark:placeholder:text-slate-400'

const sanitizeNonNegativeInt = (value) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return 0
  }
  return Math.floor(numeric)
}

const CabinetDurationField = ({
  id,
  label,
  valueSeconds,
  onChangeSeconds,
  disabled,
  inputClassName,
  containerClassName,
  labelClassName,
  helperText,
  minutesLabel = 'мин',
  secondsLabel = 'сек',
}) => {
  const totalSeconds = sanitizeNonNegativeInt(valueSeconds)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  const [minutesInput, setMinutesInput] = useState(String(minutes))
  const [secondsInput, setSecondsInput] = useState(String(seconds))

  useEffect(() => {
    setMinutesInput(String(minutes))
    setSecondsInput(String(seconds))
  }, [minutes, seconds])

  const commitDuration = (nextMinutesRaw, nextSecondsRaw) => {
    const nextMinutes = sanitizeNonNegativeInt(nextMinutesRaw)
    const nextRawSeconds = sanitizeNonNegativeInt(nextSecondsRaw)
    const overflowMinutes = Math.floor(nextRawSeconds / 60)
    const normalizedSeconds = nextRawSeconds % 60
    const normalizedMinutes = nextMinutes + overflowMinutes
    const nextTotalSeconds = normalizedMinutes * 60 + normalizedSeconds

    setMinutesInput(String(normalizedMinutes))
    setSecondsInput(String(normalizedSeconds))

    if (nextTotalSeconds !== totalSeconds) {
      onChangeSeconds(nextTotalSeconds)
    }
  }

  return (
    <CabinetFormField
      id={id}
      label={label}
      containerClassName={containerClassName}
      labelClassName={labelClassName}
    >
      <div
        className={`flex w-fit overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/70 ${
          disabled ? 'opacity-70' : ''
        }`}
      >
        <input
          id={`${id}-minutes`}
          aria-label="Минуты"
          type="number"
          min="0"
          step="1"
          inputMode="numeric"
          value={minutesInput}
          onChange={(event) => setMinutesInput(event.target.value)}
          onBlur={() => commitDuration(minutesInput, secondsInput)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.currentTarget.blur()
            }
          }}
          disabled={disabled}
          className={`${inputClassName || DEFAULT_INPUT_CLASS} w-[80px]`}
        />
        <span className="inline-flex items-center px-2 text-xs font-semibold border-l border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-300">
          {minutesLabel}
        </span>
        <input
          id={`${id}-seconds`}
          aria-label="Секунды"
          type="number"
          min="0"
          step="1"
          inputMode="numeric"
          value={secondsInput}
          onChange={(event) => setSecondsInput(event.target.value)}
          onBlur={() => commitDuration(minutesInput, secondsInput)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.currentTarget.blur()
            }
          }}
          disabled={disabled}
          className={`border-l border-slate-200 dark:border-slate-700 w-[80px] ${inputClassName || DEFAULT_INPUT_CLASS}`}
        />
        <span className="inline-flex items-center px-2 text-xs font-semibold border-l border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-300">
          {secondsLabel}
        </span>
      </div>
      {helperText ? (
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">
          {helperText}
        </p>
      ) : null}
    </CabinetFormField>
  )
}

CabinetDurationField.propTypes = {
  id: PropTypes.string.isRequired,
  label: PropTypes.node,
  valueSeconds: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
    .isRequired,
  onChangeSeconds: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  inputClassName: PropTypes.string,
  containerClassName: PropTypes.string,
  labelClassName: PropTypes.string,
  helperText: PropTypes.node,
  minutesLabel: PropTypes.string,
  secondsLabel: PropTypes.string,
}

CabinetDurationField.defaultProps = {
  label: null,
  disabled: false,
  inputClassName: DEFAULT_INPUT_CLASS,
  containerClassName: 'space-y-2',
  labelClassName: 'text-sm font-semibold text-slate-700 dark:text-slate-100',
  helperText: null,
  minutesLabel: 'Мин',
  secondsLabel: 'Сек',
}

export default CabinetDurationField
