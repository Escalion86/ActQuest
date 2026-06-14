/**
 * Общие иконки для модалок game-edit и game-tasks.
 * Вынесены из GameEditModal.js для переиспользования.
 */

export const CodePhotoBadgeIcon = () => (
  <svg
    className="h-3.5 w-3.5"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="3" y="7" width="18" height="14" rx="2" />
    <path d="M9 7l1.5-2h3L15 7" />
    <circle cx="12" cy="14" r="3.2" />
  </svg>
)

export const TaskWarningIcon = ({ title }) => (
  <span
    className="inline-flex items-center justify-center w-5 h-5"
    title={title}
    aria-label={title}
  >
    <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
      <path d="M12 3L2 21h20L12 3z" fill="#ef4444" />
      <rect x="11" y="8" width="2" height="7" rx="1" fill="#ffffff" />
      <circle cx="12" cy="18" r="1.3" fill="#ffffff" />
    </svg>
  </span>
)

export const AccordionChevronIcon = ({ isOpen }) => (
  <span
    className={`inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-600 transition-transform duration-200 dark:border-slate-600 dark:bg-slate-900/80 dark:text-slate-200 ${
      isOpen ? 'rotate-180' : 'rotate-0'
    }`}
    aria-hidden="true"
  >
    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5">
      <path
        d="M4 7.5l6 6 6-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  </span>
)
