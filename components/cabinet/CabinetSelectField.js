import PropTypes from 'prop-types'
import CabinetFormField from '@components/cabinet/CabinetFormField'

const DEFAULT_SELECT_CLASS =
  'w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200'

const CabinetSelectField = ({
  id,
  label,
  value,
  onChange,
  disabled,
  children,
  selectClassName,
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
    <select
      id={id}
      name={name || undefined}
      value={value}
      onChange={onChange}
      disabled={disabled}
      className={selectClassName || DEFAULT_SELECT_CLASS}
    >
      {children}
    </select>
  </CabinetFormField>
)

CabinetSelectField.propTypes = {
  id: PropTypes.string.isRequired,
  label: PropTypes.node,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  children: PropTypes.node.isRequired,
  selectClassName: PropTypes.string,
  containerClassName: PropTypes.string,
  labelClassName: PropTypes.string,
  name: PropTypes.string,
}

CabinetSelectField.defaultProps = {
  label: null,
  disabled: false,
  selectClassName: DEFAULT_SELECT_CLASS,
  containerClassName: 'space-y-2',
  labelClassName: 'text-sm font-semibold text-slate-700 dark:text-slate-100',
  name: null,
}

export default CabinetSelectField
