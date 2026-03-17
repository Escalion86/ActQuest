import PropTypes from 'prop-types'

const AuthSplitLayout = ({
  title,
  description,
  stepTexts,
  children,
}) => (
  <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
    <div className="max-w-6xl px-4 py-16 mx-auto">
      <div className="grid gap-10 md:grid-cols-[1.05fr_0.95fr] items-start">
        <div className="space-y-6 text-white">
          <p className="inline-flex items-center px-4 py-2 text-xs font-semibold tracking-widest uppercase rounded-full bg-white/10">
            Личный кабинет ActQuest
          </p>
          <h1 className="text-3xl font-semibold md:text-4xl">{title}</h1>
          <p className="text-base text-slate-200 md:text-lg">{description}</p>
          <ul className="space-y-3 text-sm text-slate-200 md:text-base">
            {stepTexts.map((text, index) => (
              <li key={text} className="flex items-start gap-3">
                <span className="inline-flex items-center justify-center flex-none w-8 h-8 text-sm font-semibold bg-white rounded-full text-slate-900 dark:text-slate-100 dark:bg-slate-900/80">
                  {index + 1}
                </span>
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="p-8 bg-white shadow-2xl dark:bg-slate-900/80 rounded-3xl">
          {children}
        </div>
      </div>
    </div>
  </div>
)

AuthSplitLayout.propTypes = {
  title: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
  stepTexts: PropTypes.arrayOf(PropTypes.string).isRequired,
  children: PropTypes.node.isRequired,
}

export default AuthSplitLayout
