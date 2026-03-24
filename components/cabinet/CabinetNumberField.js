import PropTypes from 'prop-types'
import CabinetFormField from '@components/cabinet/CabinetFormField'

const DEFAULT_INPUT_CLASS =
  'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100 dark:placeholder:text-slate-400'

const CabinetNumberField = ({
  id,
  label,
  value,
  onChange,
  min,
  max,
  step,
  placeholder,
  disabled,
  inputClassName,
  containerClassName,
  labelClassName,
  name,
}) => (
  <CabinetFormField
    id={id}
    label={label}
    containerClassName={containerClassName}
    labelClassName={labelClassName}
  >
    <input
      id={id}
      name={name || undefined}
      type="number"
      value={value}
      onChange={onChange}
      min={min}
      max={max}
      step={step}
      placeholder={placeholder}
      disabled={disabled}
      className={inputClassName || DEFAULT_INPUT_CLASS}
    />
  </CabinetFormField>
)

CabinetNumberField.propTypes = {
  id: PropTypes.string.isRequired,
  label: PropTypes.node,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  onChange: PropTypes.func.isRequired,
  min: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  max: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  step: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  placeholder: PropTypes.string,
  disabled: PropTypes.bool,
  inputClassName: PropTypes.string,
  containerClassName: PropTypes.string,
  labelClassName: PropTypes.string,
  name: PropTypes.string,
}

CabinetNumberField.defaultProps = {
  label: null,
  min: undefined,
  max: undefined,
  step: undefined,
  placeholder: '',
  disabled: false,
  inputClassName: DEFAULT_INPUT_CLASS,
  containerClassName: 'space-y-2',
  labelClassName: 'text-sm font-semibold text-slate-700 dark:text-slate-100',
  name: null,
}

export default CabinetNumberField
