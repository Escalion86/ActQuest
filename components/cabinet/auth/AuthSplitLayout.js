import PropTypes from 'prop-types'

const AuthSplitLayout = ({
  title,
  description,
  stepTexts,
  children,
  variant,
  showLabel,
  hideIntroOnMobile,
}) => {
  const isNeon = variant === 'neon'

  return (
    <div
      className={`min-h-screen ${
        isNeon
          ? 'relative overflow-hidden bg-[#0B001A] text-slate-100'
          : 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900'
      }`}
    >
      {isNeon && (
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-20 top-8 h-72 w-72 rounded-full bg-[#7A00FF]/20 blur-3xl" />
          <div className="absolute right-0 top-1/3 h-80 w-80 rounded-full bg-[#00D1FF]/14 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-[#1A0033] blur-3xl" />
        </div>
      )}
      <div className="relative z-10 max-w-6xl px-4 py-16 mx-auto">
        <div className="grid gap-10 md:grid-cols-[1.05fr_0.95fr] items-start">
          <div
            className={`${hideIntroOnMobile ? 'hidden md:block' : 'block'} space-y-6 ${
              isNeon ? 'text-slate-100' : 'text-white'
            }`}
          >
            {showLabel ? (
              <p
                className={`inline-flex items-center px-4 py-2 text-xs font-semibold tracking-widest uppercase rounded-full ${
                  isNeon
                    ? 'border border-[#00D1FF]/40 bg-[#00D1FF]/10 text-[#baf3ff]'
                    : 'bg-white/10'
                }`}
              >
                Личный кабинет ActQuest
              </p>
            ) : null}
            <h1 className="text-3xl font-semibold md:text-4xl">{title}</h1>
            <p className={`text-base md:text-lg ${isNeon ? 'text-slate-300' : 'text-slate-200'}`}>
              {description}
            </p>
            <ul className={`space-y-3 text-sm md:text-base ${isNeon ? 'text-slate-300' : 'text-slate-200'}`}>
              {stepTexts.map((text, index) => (
                <li key={text} className="flex items-start gap-3">
                  <span
                    className={`inline-flex items-center justify-center flex-none w-8 h-8 text-sm font-semibold rounded-full ${
                      isNeon
                        ? 'border border-[#00D1FF]/45 bg-[#00D1FF]/10 text-[#baf3ff]'
                        : 'bg-white text-slate-900 dark:text-slate-100 dark:bg-slate-900/80'
                    }`}
                  >
                    {index + 1}
                  </span>
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          </div>

          <div
            className={`p-8 rounded-3xl ${
              isNeon
                ? 'border border-[#7A00FF]/35 bg-gradient-to-b from-[#120124]/90 to-[#0b001a]/90 shadow-[0_0_0_1px_rgba(122,0,255,0.2),0_0_42px_rgba(0,209,255,0.08)]'
                : 'bg-white shadow-2xl dark:bg-slate-900/80'
            }`}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

AuthSplitLayout.propTypes = {
  title: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
  stepTexts: PropTypes.arrayOf(PropTypes.string).isRequired,
  children: PropTypes.node.isRequired,
  variant: PropTypes.oneOf(['default', 'neon']),
  showLabel: PropTypes.bool,
  hideIntroOnMobile: PropTypes.bool,
}

AuthSplitLayout.defaultProps = {
  variant: 'default',
  showLabel: true,
  hideIntroOnMobile: false,
}

export default AuthSplitLayout
