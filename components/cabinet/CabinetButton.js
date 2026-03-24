import PropTypes from 'prop-types'

const variantToneClassMap = {
  'primary:brand': 'bg-primary text-white hover:bg-blue-700 disabled:bg-blue-400',
  'primary:cyan': 'bg-cyan-600 text-white hover:bg-cyan-700 disabled:bg-cyan-500',
  'primary:danger': 'bg-rose-600 text-white hover:bg-rose-700 disabled:bg-rose-500',

  'secondary:neutral':
    'border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900/70 dark:text-slate-100 dark:hover:bg-slate-800/80',
  'secondary:brand':
    'border border-primary bg-transparent text-primary hover:bg-blue-50 dark:border-cyan-500/40 dark:text-cyan-200 dark:hover:bg-sky-500/10',
  'secondary:cyan':
    'border border-cyan-400/50 bg-cyan-500/10 text-cyan-700 hover:bg-cyan-500/20 dark:border-cyan-500/50 dark:text-cyan-200 dark:hover:bg-cyan-500/20',
  'secondary:success':
    'border border-emerald-500 bg-transparent text-emerald-700 hover:bg-emerald-50 dark:border-emerald-500/40 dark:text-emerald-300 dark:hover:bg-emerald-500/10',
  'secondary:danger':
    'border border-rose-200 bg-transparent text-rose-600 hover:bg-rose-50 dark:border-rose-500/30 dark:text-rose-300 dark:hover:bg-rose-500/10',

  'soft:neutral':
    'border border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700',
  'soft:cyan':
    'border border-cyan-300 bg-cyan-50 text-cyan-700 hover:bg-cyan-100 dark:border-cyan-500/40 dark:bg-cyan-500/10 dark:text-cyan-200 dark:hover:bg-cyan-500/20',
  'soft:success':
    'border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200 dark:hover:bg-emerald-500/20',
  'soft:danger':
    'border border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200 dark:hover:bg-rose-500/20',
}

const sizeClassMap = {
  sm: 'px-3 py-2 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-3 text-sm',
}

const CabinetButton = ({
  type,
  variant,
  tone,
  size,
  disabled,
  onClick,
  className,
  children,
}) => {
  const normalizedTone = variant === 'primary' ? tone || 'brand' : tone || 'neutral'
  const variantToneKey = `${variant}:${normalizedTone}`
  const variantClass =
    variantToneClassMap[variantToneKey] || variantToneClassMap['primary:brand']
  const sizeClass = sizeClassMap[size] || sizeClassMap.lg
  const resolvedClassName = `inline-flex justify-center rounded-xl font-semibold transition disabled:cursor-not-allowed disabled:opacity-70 ${sizeClass} ${variantClass} ${
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
  variant: PropTypes.oneOf(['primary', 'secondary', 'soft']),
  tone: PropTypes.oneOf(['neutral', 'brand', 'cyan', 'success', 'danger']),
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  disabled: PropTypes.bool,
  onClick: PropTypes.func,
  className: PropTypes.string,
  children: PropTypes.node.isRequired,
}

CabinetButton.defaultProps = {
  type: 'button',
  variant: 'primary',
  tone: undefined,
  size: 'lg',
  disabled: false,
  onClick: undefined,
  className: '',
}

export default CabinetButton
