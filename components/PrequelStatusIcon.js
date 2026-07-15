import PropTypes from 'prop-types'

import {
  PREQUEL_STATUS_COMPLETED,
  PREQUEL_STATUS_LOCKED,
  PREQUEL_STATUS_OPEN,
  resolvePrequelStatusForDate,
} from '@helpers/normalizePrequel'

const statusMeta = {
  [PREQUEL_STATUS_COMPLETED]: {
    label: 'Приквел выполнен',
    className:
      'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/50 dark:bg-emerald-500/15 dark:text-emerald-200',
  },
  [PREQUEL_STATUS_OPEN]: {
    label: 'Приквел открыт, но не выполнен',
    className:
      'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/50 dark:bg-amber-500/15 dark:text-amber-200',
  },
  [PREQUEL_STATUS_LOCKED]: {
    label: 'Приквел ещё не доступен',
    className:
      'border-slate-300 bg-slate-50 text-slate-600 dark:border-slate-500/50 dark:bg-slate-500/15 dark:text-slate-200',
  },
}

const PrequelStatusIcon = ({ prequel, progress, nowTs }) => {
  const status = resolvePrequelStatusForDate(
    prequel,
    progress,
    new Date(nowTs),
  )
  const meta = statusMeta[status] || statusMeta[PREQUEL_STATUS_LOCKED]

  return (
    <span
      className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${meta.className}`}
      role="img"
      aria-label={meta.label}
      title={meta.label}
    >
      {status === PREQUEL_STATUS_COMPLETED ? (
        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" aria-hidden="true">
          <path
            d="m4.5 10.5 3.2 3.2 7.8-7.8"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : status === PREQUEL_STATUS_OPEN ? (
        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" aria-hidden="true">
          <path
            d="M10 2.7 18 17H2L10 2.7Z"
            fill="currentColor"
            opacity="0.18"
          />
          <path
            d="M10 2.7 18 17H2L10 2.7Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path
            d="M10 7.2v4.5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <circle cx="10" cy="14.2" r="1" fill="currentColor" />
        </svg>
      ) : (
        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" aria-hidden="true">
          <circle
            cx="10"
            cy="10"
            r="7"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
          />
          <path
            d="M10 6v4.3l2.8 1.7"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </span>
  )
}

PrequelStatusIcon.propTypes = {
  prequel: PropTypes.object.isRequired,
  progress: PropTypes.object,
  nowTs: PropTypes.number.isRequired,
}

PrequelStatusIcon.defaultProps = {
  progress: null,
}

export default PrequelStatusIcon
