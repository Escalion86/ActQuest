import PropTypes from 'prop-types'
import CabinetFormField from '@components/cabinet/CabinetFormField'

const DEFAULT_TEXTAREA_CLASS =
  'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100 dark:placeholder:text-slate-400'

const CabinetTextareaField = ({
  id,
  label,
  value,
  onChange,
  rows,
  placeholder,
  disabled,
  textareaClassName,
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
    <textarea
      id={id}
      name={name || undefined}
      value={value}
      onChange={onChange}
      rows={rows}
      placeholder={placeholder}
      disabled={disabled}
      className={textareaClassName || DEFAULT_TEXTAREA_CLASS}
    />
  </CabinetFormField>
)

CabinetTextareaField.propTypes = {
  id: PropTypes.string.isRequired,
  label: PropTypes.node,
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  rows: PropTypes.number,
  placeholder: PropTypes.string,
  disabled: PropTypes.bool,
  textareaClassName: PropTypes.string,
  containerClassName: PropTypes.string,
  labelClassName: PropTypes.string,
  name: PropTypes.string,
}

CabinetTextareaField.defaultProps = {
  label: null,
  rows: 3,
  placeholder: '',
  disabled: false,
  textareaClassName: DEFAULT_TEXTAREA_CLASS,
  containerClassName: 'space-y-2',
  labelClassName: 'text-sm font-semibold text-slate-700 dark:text-slate-100',
  name: null,
}

export default CabinetTextareaField
