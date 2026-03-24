import PropTypes from 'prop-types'
import CabinetFormField from '@components/cabinet/CabinetFormField'

const DEFAULT_INPUT_CLASS =
  'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100 dark:placeholder:text-slate-400'

const CabinetInputField = ({
  id,
  label,
  type,
  value,
  onChange,
  placeholder,
  disabled,
  autoComplete,
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
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      autoComplete={autoComplete}
      className={inputClassName || DEFAULT_INPUT_CLASS}
    />
  </CabinetFormField>
)

CabinetInputField.propTypes = {
  id: PropTypes.string.isRequired,
  label: PropTypes.node,
  type: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  onChange: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
  disabled: PropTypes.bool,
  autoComplete: PropTypes.string,
  inputClassName: PropTypes.string,
  containerClassName: PropTypes.string,
  labelClassName: PropTypes.string,
  name: PropTypes.string,
}

CabinetInputField.defaultProps = {
  label: null,
  type: 'text',
  placeholder: '',
  disabled: false,
  autoComplete: undefined,
  inputClassName: DEFAULT_INPUT_CLASS,
  containerClassName: 'space-y-2',
  labelClassName: 'text-sm font-semibold text-slate-700 dark:text-slate-100',
  name: null,
}

export default CabinetInputField
