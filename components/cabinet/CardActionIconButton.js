import PropTypes from 'prop-types'
import cn from 'classnames'

export const EditCardIcon = () => (
  <svg
    className="h-5 w-5"
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
    className="h-5 w-5"
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

export const StatusCardIcon = () => (
  <svg
    className="h-5 w-5"
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M4 4h12M4 10h12M4 16h8"
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
  const baseClassName =
    'inline-flex cursor-pointer items-center justify-center rounded-full border-2 border-cyan-300/90 bg-cyan-50/80 text-cyan-700 shadow-sm transition-all duration-150 hover:scale-105 hover:border-cyan-600 hover:bg-cyan-200 hover:text-cyan-950 hover:shadow-md active:scale-100 focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:ring-offset-1 dark:border-[#00D1FF]/45 dark:bg-[#00D1FF]/10 dark:text-[#bdf4ff] dark:shadow-[0_0_0_1px_rgba(0,209,255,0.18)] dark:hover:border-[#00D1FF]/85 dark:hover:bg-[#00D1FF]/28 dark:hover:text-white dark:hover:shadow-[0_0_0_1px_rgba(0,209,255,0.28),0_0_18px_rgba(0,209,255,0.28)] dark:focus:ring-[#00D1FF]/45'

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
        className={cn(baseClassName, 'h-9 w-9', className)}
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
      className={cn(baseClassName, 'h-9 w-9', className)}
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
  className: '',
}

export default CardActionIconButton
