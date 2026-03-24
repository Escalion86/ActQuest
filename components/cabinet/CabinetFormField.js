import PropTypes from 'prop-types'

const DEFAULT_CONTAINER_CLASS = 'space-y-2'
const DEFAULT_LABEL_CLASS = 'text-sm font-semibold text-slate-700 dark:text-slate-100'

const CabinetFormField = ({
  id,
  label,
  containerClassName,
  labelClassName,
  children,
}) => (
  <div className={containerClassName || DEFAULT_CONTAINER_CLASS}>
    {label ? (
      <label
        htmlFor={id || undefined}
        className={labelClassName || DEFAULT_LABEL_CLASS}
      >
        {label}
      </label>
    ) : null}
    {children}
  </div>
)

CabinetFormField.propTypes = {
  id: PropTypes.string,
  label: PropTypes.node,
  containerClassName: PropTypes.string,
  labelClassName: PropTypes.string,
  children: PropTypes.node.isRequired,
}

CabinetFormField.defaultProps = {
  id: null,
  label: null,
  containerClassName: DEFAULT_CONTAINER_CLASS,
  labelClassName: DEFAULT_LABEL_CLASS,
}

export default CabinetFormField
