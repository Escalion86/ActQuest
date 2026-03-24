import PropTypes from 'prop-types'

const variantClassMap = {
  primary: 'bg-primary text-white hover:bg-blue-700 disabled:bg-blue-400',
  secondary:
    'border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900/70 dark:text-slate-100 dark:hover:bg-slate-800/80',
  danger:
    'border border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200 dark:hover:bg-rose-500/20',
}

const CabinetButton = ({
  type,
  variant,
  disabled,
  onClick,
  className,
  children,
}) => {
  const variantClass = variantClassMap[variant] || variantClassMap.primary
  const resolvedClassName = `inline-flex justify-center px-5 py-3 text-sm font-semibold rounded-xl transition disabled:cursor-not-allowed disabled:opacity-70 ${variantClass} ${
    className || ''
  }`.trim()

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={resolvedClassName}
    >
      {children}
    </button>
  )
}

CabinetButton.propTypes = {
  type: PropTypes.oneOf(['button', 'submit', 'reset']),
  variant: PropTypes.oneOf(['primary', 'secondary', 'danger']),
  disabled: PropTypes.bool,
  onClick: PropTypes.func,
  className: PropTypes.string,
  children: PropTypes.node.isRequired,
}

CabinetButton.defaultProps = {
  type: 'button',
  variant: 'primary',
  disabled: false,
  onClick: undefined,
  className: '',
}

export default CabinetButton
