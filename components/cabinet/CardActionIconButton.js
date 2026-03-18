import PropTypes from 'prop-types'

export const EditCardIcon = () => (
  <svg
    className="h-4 w-4"
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M4 13.5V16h2.5L15 7.5l-2.5-2.5L4 13.5z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M12.5 5.5l2-2a1.5 1.5 0 112.121 2.121l-2 2"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

export const TeamCardIcon = () => (
  <svg
    className="h-4 w-4"
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M7 10a3 3 0 100-6 3 3 0 000 6z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M13.5 9.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M2.5 15.5a4.5 4.5 0 019 0V17h-9v-1.5z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M13.5 12.5c1.933 0 3.5 1.567 3.5 3.5V17h-5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const CardActionIconButton = ({
  as: Component,
  onClick,
  label,
  title,
  className,
  children,
}) => {
  if (Component === 'span' || Component === 'div') {
    return (
      <Component
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onClick(event)
          }
        }}
        className={className}
        aria-label={label}
        title={title || label}
      >
        {children}
      </Component>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={className}
      aria-label={label}
      title={title || label}
    >
      {children}
    </button>
  )
}

CardActionIconButton.propTypes = {
  as: PropTypes.oneOf(['button', 'span', 'div']),
  onClick: PropTypes.func.isRequired,
  label: PropTypes.string.isRequired,
  title: PropTypes.string,
  className: PropTypes.string,
  children: PropTypes.node.isRequired,
}

CardActionIconButton.defaultProps = {
  as: 'button',
  title: null,
  className:
    'inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-cyan-300 text-cyan-700 transition hover:border-cyan-500 hover:bg-cyan-50 hover:text-cyan-800 focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:ring-offset-1 dark:border-slate-600 dark:text-slate-300 dark:hover:border-violet-400 dark:hover:bg-transparent dark:hover:text-violet-100 dark:focus:ring-primary',
}

export default CardActionIconButton
