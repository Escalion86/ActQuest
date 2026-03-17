import PropTypes from 'prop-types'

const toneClasses = {
  info: 'text-slate-600 border-slate-200 bg-slate-50',
  warning: 'text-amber-700 border-amber-200 bg-amber-50',
  error: 'text-red-600 border-red-200 bg-red-50',
  success: 'text-emerald-700 border-emerald-200 bg-emerald-50',
}

const toneClassesNeon = {
  info: 'text-[#baf3ff] border-[#00D1FF]/35 bg-[#00D1FF]/10',
  warning: 'text-[#ffe7b2] border-[#ffbf47]/40 bg-[#ffbf47]/12',
  error: 'text-[#ffb7c2] border-[#ff4d6d]/35 bg-[#ff4d6d]/12',
  success: 'text-[#bdf7d8] border-[#1fdc95]/35 bg-[#1fdc95]/12',
}

const NoticeBanner = ({ children, tone, className, centered, variant }) => {
  const resolvedTone = toneClasses[tone] ? tone : 'info'
  const alignment = centered ? 'text-center' : ''
  const palette = variant === 'neon' ? toneClassesNeon : toneClasses

  return (
    <div
      className={`w-full px-3 py-2 text-sm border rounded-xl ${palette[resolvedTone]} ${alignment} ${className}`.trim()}
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
  variant: PropTypes.oneOf(['default', 'neon']),
}

NoticeBanner.defaultProps = {
  tone: 'info',
  className: '',
  centered: false,
  variant: 'default',
}

export default NoticeBanner
