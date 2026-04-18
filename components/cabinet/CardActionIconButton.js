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

export const StatusCardIcon = ({ status }) => {
  const normalizedStatus = String(status || '').toLowerCase()

  if (normalizedStatus === 'active') {
    return (
      <svg
        className="h-5 w-5"
        viewBox="0 0 20 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle
          cx="10"
          cy="10"
          r="6.75"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M10 6.5V10.2L12.7 11.8"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }

  if (normalizedStatus === 'started') {
    return (
      <svg
        className="h-5 w-5"
        viewBox="0 0 20 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M7.25 5.5L14.5 10L7.25 14.5V5.5Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }

  if (normalizedStatus === 'finished') {
    return (
      <svg
        className="h-5 w-5"
        viewBox="0 0 20 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M5.5 10.5L8.6 13.6L14.5 7.7"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }

  if (normalizedStatus === 'closed') {
    return (
      <svg
        className="h-5 w-5"
        viewBox="0 0 20 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect
          x="4.5"
          y="9"
          width="11"
          height="7"
          rx="1.75"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M6.8 9V7.6C6.8 5.95 8.15 4.6 9.8 4.6H10.2C11.85 4.6 13.2 5.95 13.2 7.6V9"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    )
  }

  return (
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
}

export const TargetCardIcon = () => (
  <svg
    className="h-5 w-5"
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle cx="10" cy="10" r="6.5" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="10" cy="10" r="3.2" stroke="currentColor" strokeWidth="1.5" />
    <path
      d="M10 1.75V4.25M10 15.75V18.25M1.75 10H4.25M15.75 10H18.25"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
)

export const GameControlCardIcon = () => (
  <svg
    className="h-5 w-5"
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect
      x="3"
      y="4"
      width="14"
      height="12"
      rx="2"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <path d="M3 8h14" stroke="currentColor" strokeWidth="1.5" />
    <path d="M7 8v8M11 8v8" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="7" cy="11" r="0.8" fill="currentColor" />
    <circle cx="11" cy="11" r="0.8" fill="currentColor" />
  </svg>
)

export const TeamStatsCardIcon = () => (
  <svg
    className="h-5 w-5"
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect
      x="3.5"
      y="3.5"
      width="13"
      height="13"
      rx="2"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <path d="M6.5 13V10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M10 13V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M13.5 13V6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
)

export const CopyCardIcon = () => (
  <svg
    className="h-5 w-5"
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect
      x="7"
      y="4.5"
      width="8.5"
      height="11"
      rx="1.8"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <path
      d="M5.5 12.8H4.7C3.76 12.8 3 12.04 3 11.1V5.7C3 4.76 3.76 4 4.7 4H10.1C11.04 4 11.8 4.76 11.8 5.7V6.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

export const MegaphoneCardIcon = () => (
  <svg
    className="h-5 w-5"
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M4.5 9.1V10.9C4.5 11.45 4.95 11.9 5.5 11.9H7.3L9.9 14V6L7.3 8.1H5.5C4.95 8.1 4.5 8.55 4.5 9.1Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M12.6 8.2C13.3 8.75 13.75 9.56 13.75 10.5C13.75 11.44 13.3 12.25 12.6 12.8"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <path
      d="M14.7 6.9C15.8 7.88 16.5 9.29 16.5 10.86C16.5 12.43 15.8 13.84 14.7 14.82"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
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

StatusCardIcon.propTypes = {
  status: PropTypes.string,
}

StatusCardIcon.defaultProps = {
  status: '',
}

export default CardActionIconButton
