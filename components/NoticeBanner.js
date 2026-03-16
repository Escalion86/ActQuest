import PropTypes from 'prop-types'

const toneClasses = {
  info: 'text-slate-600 border-slate-200 bg-slate-50',
  warning: 'text-amber-700 border-amber-200 bg-amber-50',
  error: 'text-red-600 border-red-200 bg-red-50',
  success: 'text-emerald-700 border-emerald-200 bg-emerald-50',
}

const NoticeBanner = ({ children, tone, className, centered }) => {
  const resolvedTone = toneClasses[tone] ? tone : 'info'
  const alignment = centered ? 'text-center' : ''

  return (
    <div
      className={`w-full px-3 py-2 text-sm border rounded-xl ${toneClasses[resolvedTone]} ${alignment} ${className}`.trim()}
    >
      {children}
    </div>
  )
}

NoticeBanner.propTypes = {
  children: PropTypes.node.isRequired,
  tone: PropTypes.oneOf(['info', 'warning', 'error', 'success']),
  className: PropTypes.string,
  centered: PropTypes.bool,
}

NoticeBanner.defaultProps = {
  tone: 'info',
  className: '',
  centered: false,
}

export default NoticeBanner
