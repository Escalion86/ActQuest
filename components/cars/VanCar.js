import PropTypes from 'prop-types'
import cn from 'classnames'

const VanCar = ({
  name,
  color = '#000000',
  rowHeight,
  isDarkTheme = false,
  showName = true,
  containerWidth = 200,
  svgWidth = '92px',
  svgHeight = '46px',
  className = '',
}) => (
  <div
    className={cn('flex flex-col items-end justify-end gap-x-2', className)}
    style={{
      height: rowHeight,
      width: containerWidth,
    }}
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={svgWidth}
      height={svgHeight}
      viewBox="0 0 92 46"
      preserveAspectRatio="xMidYMid meet"
      style={{
        filter: isDarkTheme
          ? 'drop-shadow(0 0 8px rgba(14,165,233,0.36))'
          : 'drop-shadow(0 1px 2px rgba(15,23,42,0.22))',
      }}
    >
      <path
        d="M8 31 L8 17 L16 17 L16 10 L63 10 L72 14 L84 14 L84 31 Z"
        fill={color}
        stroke={isDarkTheme ? '#020617' : '#0f172a'}
        strokeWidth="1.5"
      />
      <rect
        x="20"
        y="12"
        width="12.5"
        height="7"
        rx="1"
        fill={isDarkTheme ? 'rgba(191,219,254,0.24)' : 'rgba(148,163,184,0.38)'}
      />
      <rect
        x="35"
        y="12"
        width="11.5"
        height="7"
        rx="1"
        fill={isDarkTheme ? 'rgba(191,219,254,0.24)' : 'rgba(148,163,184,0.38)'}
      />
      <rect
        x="48.5"
        y="12"
        width="12.5"
        height="7"
        rx="1"
        fill={isDarkTheme ? 'rgba(191,219,254,0.24)' : 'rgba(148,163,184,0.38)'}
      />
      <path
        d="M63 10 L72 14"
        stroke={isDarkTheme ? '#7dd3fc' : '#0f172a'}
        strokeWidth="1"
        opacity="0.75"
      />
      <circle
        cx="28"
        cy="33.7"
        r="5.4"
        fill={isDarkTheme ? '#020617' : '#111827'}
        stroke={isDarkTheme ? '#38bdf8' : '#0f172a'}
        strokeWidth={isDarkTheme ? '1.4' : '1.1'}
      />
      <circle
        cx="66.2"
        cy="33.7"
        r="5.4"
        fill={isDarkTheme ? '#020617' : '#111827'}
        stroke={isDarkTheme ? '#38bdf8' : '#0f172a'}
        strokeWidth={isDarkTheme ? '1.4' : '1.1'}
      />
      <circle
        cx="28"
        cy="33.7"
        r="2.4"
        fill={isDarkTheme ? '#0ea5e9' : '#64748b'}
        opacity="0.75"
      />
      <circle
        cx="66.2"
        cy="33.7"
        r="2.4"
        fill={isDarkTheme ? '#0ea5e9' : '#64748b'}
        opacity="0.75"
      />
    </svg>

    {showName ? (
      <div
        className={cn(
          '-mt-0.5 -translate-x-2 text-right whitespace-nowrap',
          isDarkTheme ? 'text-cyan-100/90' : 'text-slate-900',
        )}
        style={{
          right: 70,
          fontSize: '12px',
          textAlign: 'right',
          lineHeight: '10px',
        }}
      >
        {name ?? '???'}
      </div>
    ) : null}
  </div>
)

VanCar.propTypes = {
  name: PropTypes.string,
  color: PropTypes.string,
  rowHeight: PropTypes.number,
  isDarkTheme: PropTypes.bool,
  showName: PropTypes.bool,
  containerWidth: PropTypes.number,
  svgWidth: PropTypes.string,
  svgHeight: PropTypes.string,
  className: PropTypes.string,
}

VanCar.defaultProps = {
  name: '???',
  color: '#000000',
  rowHeight: 40,
  isDarkTheme: false,
  showName: true,
  containerWidth: 200,
  svgWidth: '92px',
  svgHeight: '46px',
  className: '',
}

export default VanCar
