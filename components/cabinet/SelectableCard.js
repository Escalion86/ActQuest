import PropTypes from 'prop-types'
import cn from 'classnames'

const SelectableCard = ({
  as: Component = 'div',
  isActive = false,
  className = '',
  children = null,
  ...props
}) => {
  return (
    <Component
      className={cn(
        'rounded-2xl border p-4 transition',
        'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/80',
        'hover:border-primary hover:bg-blue-50 dark:hover:bg-violet-500/10',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
        isActive && 'border-primary bg-blue-50 shadow-sm dark:border-violet-400 dark:bg-violet-500/10',
        className
      )}
      {...props}
    >
      {children}
    </Component>
  )
}

SelectableCard.propTypes = {
  as: PropTypes.elementType,
  isActive: PropTypes.bool,
  className: PropTypes.string,
  children: PropTypes.node,
}

export default SelectableCard
